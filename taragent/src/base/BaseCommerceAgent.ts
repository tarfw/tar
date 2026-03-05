// src/base/BaseCommerceAgent.ts — Shared base class for all 10 TAR commerce agents
//
// All domain agents (UserAgent, StoreAgent, OrderAgent…) extend this class.
// Subclasses override only:
//   getTools()       → returns their domain tool list
//   getSystemPrompt() → returns their role-contextualised system prompt
//
// This pattern eliminates all code duplication across agents.

import { Agent } from "agents";
import { OpenAI } from "openai";
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from "openai/resources/chat/completions";

import { executeAction } from "../actions/executeAction";
import { fetchGroupRoles } from "../db";
import {
    ACTION_HISTORY_LIMIT,
    AMBIGUOUS_HISTORY_LIMIT,
    QUERY_HISTORY_LIMIT,
    classifyIntent,
    greetingReply,
} from "../intent";
import { getToolsForAgent, isToolAllowedForAgent } from "../rbac";
import type {
    AgentState,
    AgentType,
    ChatContext,
    Env,
    GroupRole,
} from "../types";

export abstract class BaseCommerceAgent extends Agent<Env, AgentState> {
  /** Override in each agent subclass — returns the domain-specific tool list */
  abstract getAgentType(): AgentType;
  abstract getAllTools(): ChatCompletionTool[];
  abstract buildPrompt(role: GroupRole): string;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onConnect(connection: any): Promise<void> {
    connection.accept();
    connection.send(
      JSON.stringify({
        type: "state",
        agent: this.getAgentType(),
        data: this.state,
      }),
    );
  }

  async onMessage(connection: any, message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message) as {
        type: string;
        context?: ChatContext;
      };
      if (parsed.type === "ping") {
        connection.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (parsed.type === "chat" && parsed.context) {
        const reply = await this.handleWebhook(parsed.context);
        connection.send(JSON.stringify({ type: "reply", text: reply }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      connection.send(JSON.stringify({ type: "error", message: msg }));
    }
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", agent: this.getAgentType() });
    }
    if (request.method === "POST" && url.pathname === "/chat") {
      try {
        const context = (await request.json()) as ChatContext;
        const reply = await this.handleWebhook(context);
        return Response.json({ reply });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ error: msg }, { status: 400 });
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ── Alarms (Scheduled Jobs) ────────────────────────────────────────────────

  async onAlarm(): Promise<void> {
    const alarmTime = Date.now();
    console.log(
      `[${this.getAgentType()}] Alarm fired at ${new Date(alarmTime).toISOString()}`,
    );

    try {
      // 1. Fetch pending scheduled jobs/reminders from embedded SQLite
      const pending = this.sql<{
        id: number;
        chat_id: string;
        content: string;
      }>`
        SELECT id, chat_id, content FROM scheduled_jobs 
        WHERE due_at <= ${alarmTime} AND status = 'pending'
      `;

      for await (const job of pending) {
        console.log(
          `[${this.getAgentType()}] Executing job ${job.id} for chat ${job.chat_id}`,
        );

        // 2. Format a system-initiated message for the AI to "announce" the reminder
        const context: ChatContext = {
          source: "system",
          chatId: job.chat_id,
          userId: "system",
          userName: "System",
          text: `⏰ SCHEDULED REMINDER: ${job.content}`,
          role: "readonly",
          agentType: this.getAgentType(),
        };

        const reply = await this.handleWebhook(context);

        // 3. Mark job as completed
        await this
          .sql`UPDATE scheduled_jobs SET status = 'completed' WHERE id = ${job.id}`;
      }

      // 4. Set next alarm if there are more pending jobs
      const nextJob = this.sql<{ due_at: number }>`
        SELECT due_at FROM scheduled_jobs WHERE status = 'pending' ORDER BY due_at ASC LIMIT 1
      `;
      const next = await nextJob.next();
      if (!next.done) {
        await this.storage.setAlarm(next.value.due_at);
      }
    } catch (err) {
      console.error(`[${this.getAgentType()}] onAlarm failed:`, err);
    }
  }

  // ── Core Pipeline ──────────────────────────────────────────────────────────

  async handleWebhook(ctx: ChatContext): Promise<string> {
    const { chatId, userId, userName, text, role, source } = ctx;
    const agentType = this.getAgentType();

    console.log(
      `[${agentType}] ${source} | chat:${chatId} | role:${role} | "${text}"`,
    );

    // Step 1: Local intent pre-check — zero tokens
    const intent = classifyIntent(text);
    if (intent === "GREETING") return greetingReply(userName);

    // Step 2: Dynamic history window based on intent
    const historyLimit =
      intent === "ACTION"
        ? ACTION_HISTORY_LIMIT
        : intent === "QUERY"
          ? QUERY_HISTORY_LIMIT
          : AMBIGUOUS_HISTORY_LIMIT;

    // Step 3: Role-filtered tools for this agent
    const tools = getToolsForAgent(agentType, role, this.getAllTools());

    // Step 4: Build Groq messages
    const history = await this.loadHistory(chatId, historyLimit);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: this.buildPrompt(role) },
      ...history,
      { role: "user", content: `[${userName}]: ${text}` },
    ];

    if (!this.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing.");

    const groq = new OpenAI({
      apiKey: this.env.GROQ_API_KEY,
      baseURL: this.env.GROQ_BASE_URL,
    });
    let assistantReply = "";

    try {
      // Step 5: Groq function calling — NL → structured JSON
      const completion = await groq.chat.completions.create({
        model: this.env.GROQ_MODEL || "llama3-70b-8192",
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        temperature: 0.2,
        max_tokens: 600,
      });

      const responseMessage = completion.choices[0].message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            /* ignore */
          }

          // Server-side RBAC guard
          if (
            !isToolAllowedForAgent(
              toolName,
              agentType,
              role,
              this.getAllTools(),
            )
          ) {
            console.warn(
              `[${agentType}] RBAC blocked: ${toolName} for role ${role}`,
            );
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `❌ "${toolName}" not allowed for role ${role}.`,
            });
            continue;
          }

          const result = await executeAction(
            toolName,
            toolArgs,
            this.env,
            this,
            {
              chatId,
              source,
            },
          );
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Step 6: Final summary call (no tools, cheaper)
        // We inject the system instruction to be very clear about the actions taken.
        const finalCompletion = await groq.chat.completions.create({
          model: this.env.GROQ_MODEL || "llama3-70b-8192",
          messages: [
            ...messages,
            {
              role: "system",
              content:
                "Provide a concise, friendly confirmation to the user about the actions you just performed. Mention IDs or values updated.",
            },
          ],
          temperature: 0.3,
          max_tokens: 400,
        });
        assistantReply =
          finalCompletion.choices[0]?.message?.content ?? "Done.";
      } else {
        assistantReply = responseMessage.content ?? "I couldn't process that.";
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${agentType}] Groq failed:`, msg);
      assistantReply = `⚠️ Error processing your request. Please try again.`;
    }

    await this.saveHistory(chatId, userId, text, assistantReply);
    this.broadcast(
      JSON.stringify({
        type: "activity",
        agent: agentType,
        chatId,
        source,
        role,
        intent,
        ts: new Date().toISOString(),
      }),
    );
    return assistantReply;
  }

  // ── RBAC State Sync ────────────────────────────────────────────────────────

  async syncGroupRoles(): Promise<void> {
    try {
      const groupRoles = await fetchGroupRoles(this.env);
      this.setState({ ...this.state, groupRoles, lastSync: Date.now() });
    } catch (err) {
      console.error("[BaseAgent] syncGroupRoles failed:", err);
    }
  }

  resolveGroupRole(chatGroupId: string): GroupRole {
    const roles = this.state?.groupRoles ?? {};
    return (roles[chatGroupId] ?? "default") as GroupRole;
  }

  // ── Conversation History ── (embedded per-agent SQLite, short-term memory) ──

  private async loadHistory(
    chatId: string,
    limit: number,
  ): Promise<ChatCompletionMessageParam[]> {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          user_id TEXT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_history_chat ON conversation_history(chat_id);

        CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          content TEXT NOT NULL,
          due_at INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON scheduled_jobs(status, due_at);
      `;
      const rows = this.sql<{ role: string; content: string }>`
        SELECT role, content FROM conversation_history
        WHERE chat_id = ${chatId} ORDER BY created_at DESC LIMIT ${limit}
      `;
      const msgs: ChatCompletionMessageParam[] = [];
      for await (const row of rows)
        msgs.unshift({
          role: row.role as "user" | "assistant",
          content: row.content,
        });
      return msgs;
    } catch {
      return [];
    }
  }

  private async saveHistory(
    chatId: string,
    userId: string,
    userText: string,
    assistantText: string,
  ): Promise<void> {
    try {
      await this
        .sql`INSERT INTO conversation_history (chat_id, user_id, role, content) VALUES (${chatId}, ${userId}, 'user', ${userText})`;
      await this
        .sql`INSERT INTO conversation_history (chat_id, user_id, role, content) VALUES (${chatId}, ${userId}, 'assistant', ${assistantText})`;
      await this
        .sql`DELETE FROM conversation_history WHERE chat_id = ${chatId} AND id NOT IN (SELECT id FROM conversation_history WHERE chat_id = ${chatId} ORDER BY created_at DESC LIMIT 200)`;
    } catch (err) {
      console.error("[BaseAgent] saveHistory failed:", err);
    }
  }
}
