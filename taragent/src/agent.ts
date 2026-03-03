// src/agent.ts — TarAgent: the core Cloudflare Agent for TAR Commerce
// Extends the Cloudflare Agents SDK Agent class.
// Handles:
//  - WebSocket connections from clients (onConnect/onMessage)
//  - HTTP requests (onRequest) for direct API calls
//  - The central handleWebhook() pipeline: context → Groq → tools → DB → reply

import { Agent } from "agents";
import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { executeAction, fetchGroupRoles } from "./db";
import { buildSystemPrompt } from "./prompts";
import { getToolsForRole, isToolAllowed, resolveRole } from "./rbac";
import type { AgentState, ChatContext, Env, GroupRole } from "./types";

// ─── Agent Class ───────────────────────────────────────────────────────────────

export class TarAgent extends Agent<Env, AgentState> {
  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Called when a WebSocket client connects to the Agent.
   * Accepts the connection and syncs current state.
   */
  async onConnect(connection: any): Promise<void> {
    connection.accept();
    // Send current state snapshot on connect
    connection.send(JSON.stringify({ type: "state", data: this.state }));
  }

  /**
   * Called when a WebSocket message arrives.
   * Supports: { type: 'ping' } heartbeat and
   *           { type: 'chat', context: ChatContext } for direct webhook-style calls.
   */
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
      console.error("[TarAgent.onMessage] Error:", msg);
      connection.send(JSON.stringify({ type: "error", message: msg }));
    }
  }

  /**
   * Called on HTTP requests routed to this Agent.
   * Handles health checks and direct webhook-style POST calls.
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", agent: "TarAgent" });
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

  // ── Core Webhook Pipeline ──────────────────────────────────────────────────

  /**
   * The central intelligence pipeline for TAR Agent.
   *
   * 1. Resolve RBAC role → filter tools
   * 2. Load conversation history from embedded SQLite
   * 3. Call Groq LLM with role-appropriate tools
   * 4. Execute any tool calls via db.executeAction()
   * 5. Get LLM's final natural language reply
   * 6. Persist exchange to SQLite history
   * 7. Return reply string to the calling webhook adapter
   */
  async handleWebhook(ctx: ChatContext): Promise<string> {
    const { chatId, userId, userName, text, role, source } = ctx;

    console.log(
      `[TarAgent] ${source} | chat:${chatId} | user:${userId} | role:${role} | "${text}"`,
    );

    // 1. Get role-filtered tools
    const tools = getToolsForRole(role);

    // 2. Load recent conversation history from the Agent's embedded SQLite
    const history = await this.loadHistory(chatId, 10);

    // 3. Build messages array for Groq
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(role) },
      ...history,
      { role: "user", content: `[${userName}]: ${text}` },
    ];

    // 4. Call Groq (OpenAI-compatible API)
    if (!this.env.GROQ_API_KEY) {
      throw new Error(
        "GROQ_API_KEY is missing. In local development, ensure it is set in your .dev.vars file.",
      );
    }

    const groq = new OpenAI({
      apiKey: this.env.GROQ_API_KEY,
      baseURL: this.env.GROQ_BASE_URL,
    });

    let assistantReply = "";

    try {
      const completion = await groq.chat.completions.create({
        model: this.env.GROQ_MODEL || "llama3-70b-8192",
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        temperature: 0.3, // Keep responses deterministic for operations
        max_tokens: 800,
      });

      const choice = completion.choices[0];
      const responseMessage = choice.message;

      // 5. Execute tool calls if the LLM requested them
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add assistant's tool-call message to the chain
        messages.push(responseMessage);

        const toolResults: string[] = [];

        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
          } catch {
            console.error(
              `[TarAgent] Failed to parse tool args for ${toolName}`,
            );
          }

          // Server-side RBAC guard — belt-and-suspenders check
          if (!isToolAllowed(toolName, role)) {
            console.warn(
              `[TarAgent] RBAC blocked: ${toolName} for role ${role}`,
            );
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `❌ Tool "${toolName}" is not allowed for your role.`,
            });
            continue;
          }

          // Execute the tool
          const result = await executeAction(toolName, toolArgs, this.env, {
            chatId,
            source,
          });
          toolResults.push(result);

          // Add tool result to message chain
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // 6. Get the final reply with tool results incorporated
        const finalCompletion = await groq.chat.completions.create({
          model: this.env.GROQ_MODEL || "llama3-70b-8192",
          messages,
          temperature: 0.3,
          max_tokens: 600,
        });

        assistantReply =
          finalCompletion.choices[0]?.message?.content ??
          toolResults.join("\n");
      } else {
        // No tool calls — plain conversational reply
        assistantReply =
          responseMessage.content ?? "I couldn't process that request.";
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[TarAgent] Groq call failed:", msg);
      assistantReply = `⚠️ I ran into an issue processing your request. Please try again.`;
    }

    // 7. Persist to embedded SQLite history
    await this.saveHistory(chatId, userId, text, assistantReply);

    // 8. Broadcast state update to any connected WebSocket clients
    this.broadcast(
      JSON.stringify({
        type: "activity",
        chatId,
        source,
        role,
        timestamp: new Date().toISOString(),
      }),
    );

    return assistantReply;
  }

  // ── RBAC State Sync ────────────────────────────────────────────────────────

  /**
   * Refreshes the group→role mapping from Turso and stores in Agent state.
   * Called periodically or on startup.
   */
  async syncGroupRoles(): Promise<void> {
    try {
      const groupRoles = await fetchGroupRoles(this.env);
      this.setState({
        ...this.state,
        groupRoles,
        lastSync: Date.now(),
      });
    } catch (err) {
      console.error("[TarAgent] syncGroupRoles failed:", err);
    }
  }

  /** Resolves the GroupRole for a chat group ID from cached state. */
  resolveGroupRole(chatGroupId: string): GroupRole {
    const roles = this.state?.groupRoles ?? {};
    return resolveRole(chatGroupId, roles);
  }

  // ── Conversation History ───────────────────────────────────────────────────

  /** Loads the last N message pairs from the Agent's embedded SQLite. */
  private async loadHistory(
    chatId: string,
    limit: number,
  ): Promise<ChatCompletionMessageParam[]> {
    try {
      // Ensure history table exists
      await this.sql`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id TEXT NOT NULL,
          user_id TEXT,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `;

      const rows = this.sql<{
        role: string;
        content: string;
      }>`
        SELECT role, content FROM conversation_history
        WHERE chat_id = ${chatId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const messages: ChatCompletionMessageParam[] = [];
      for await (const row of rows) {
        messages.unshift({
          role: row.role as "user" | "assistant",
          content: row.content,
        });
      }
      return messages;
    } catch {
      return [];
    }
  }

  /** Persists a user + assistant exchange to embedded SQLite history. */
  private async saveHistory(
    chatId: string,
    userId: string,
    userText: string,
    assistantText: string,
  ): Promise<void> {
    try {
      await this.sql`
        INSERT INTO conversation_history (chat_id, user_id, role, content)
        VALUES (${chatId}, ${userId}, 'user', ${userText})
      `;
      await this.sql`
        INSERT INTO conversation_history (chat_id, user_id, role, content)
        VALUES (${chatId}, ${userId}, 'assistant', ${assistantText})
      `;
      // Prune old messages — keep last 200 per chat
      await this.sql`
        DELETE FROM conversation_history
        WHERE chat_id = ${chatId}
          AND id NOT IN (
            SELECT id FROM conversation_history
            WHERE chat_id = ${chatId}
            ORDER BY created_at DESC
            LIMIT 200
          )
      `;
    } catch (err) {
      console.error("[TarAgent] saveHistory failed:", err);
    }
  }

  // ── Scheduled Tasks ────────────────────────────────────────────────────────

  /** Periodic role sync — called by Agent scheduler (set up in onRequest init) */
  async scheduledRoleSync(_data: unknown): Promise<void> {
    await this.syncGroupRoles();
    console.log("[TarAgent] Scheduled group role sync complete.");
  }
}
