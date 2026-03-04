// src/index.ts — TAR Universal Commerce Agent — Main Worker Entry Point
//
// Architecture:
//   One Cloudflare Worker hosts 10 domain agents as Durable Objects.
//   Each webhook route resolves the target agent from the ?agent= query param
//   or defaults to a sensible agent based on the platform context.
//
// WebSocket routing:
//   /agents/OrderAgent/order456   → OrderAgent instance "order456"
//   /agents/StoreAgent/shop123    → StoreAgent instance "shop123"

import { getAgentByName, routeAgentRequest } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";

// 10 agent classes
import { CatalogAgent } from "./agents/CatalogAgent";
import { ChatAgent } from "./agents/ChatAgent";
import { DriverAgent } from "./agents/DriverAgent";
import { FleetAgent } from "./agents/FleetAgent";
import { InventoryAgent } from "./agents/InventoryAgent";
import { OrderAgent } from "./agents/OrderAgent";
import { SearchAgent } from "./agents/SearchAgent";
import { StoreAgent } from "./agents/StoreAgent";
import { TaskAgent } from "./agents/TaskAgent";
import { UserAgent } from "./agents/UserAgent";

// Infrastructure
import { bootstrapSchema, getTursoClient } from "./db";
import type { AgentType, Env, GroupRole } from "./types";
import { AGENT_BINDING_MAP } from "./types";

// Platform adapters (unchanged)
import {
  parseSlackEvent,
  sendSlackMessage,
  verifySlackSignature,
} from "./adapters/slack";
import { parseTelegramUpdate, sendTelegramMessage } from "./adapters/telegram";
import {
  parseWhatsAppMessage,
  sendWhatsAppMessage,
  verifyWhatsAppChallenge,
} from "./adapters/whatsapp";

// ─── App ───────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Helper: resolve AgentType from request ────────────────────────────────────

function resolveAgentType(
  req: Request,
  fallback: AgentType = "order",
): AgentType {
  const url = new URL(req.url);
  const param = url.searchParams.get("agent") as AgentType | null;
  const valid: AgentType[] = [
    "user",
    "store",
    "order",
    "driver",
    "inventory",
    "catalog",
    "fleet",
    "chat",
    "search",
    "task",
  ];
  return param && valid.includes(param) ? param : fallback;
}

// ─── Helper: get agent instance by type ────────────────────────────────────────

async function getAgent(env: Env, agentType: AgentType, instanceName = "main") {
  const bindingKey = AGENT_BINDING_MAP[agentType];
  const binding = (env as any)[bindingKey];
  if (!binding) throw new Error(`Agent binding not found: ${bindingKey}`);

  switch (agentType) {
    case "user":
      return getAgentByName<Env, UserAgent>(binding, instanceName);
    case "store":
      return getAgentByName<Env, StoreAgent>(binding, instanceName);
    case "order":
      return getAgentByName<Env, OrderAgent>(binding, instanceName);
    case "driver":
      return getAgentByName<Env, DriverAgent>(binding, instanceName);
    case "inventory":
      return getAgentByName<Env, InventoryAgent>(binding, instanceName);
    case "catalog":
      return getAgentByName<Env, CatalogAgent>(binding, instanceName);
    case "fleet":
      return getAgentByName<Env, FleetAgent>(binding, instanceName);
    case "chat":
      return getAgentByName<Env, ChatAgent>(binding, instanceName);
    case "search":
      return getAgentByName<Env, SearchAgent>(binding, instanceName);
    case "task":
      return getAgentByName<Env, TaskAgent>(binding, instanceName);
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "tar-agent-universal",
    agents: 10,
    ts: new Date().toISOString(),
  }),
);

// ─── Admin: Bootstrap DB Schema ────────────────────────────────────────────────

app.post("/admin/bootstrap", async (c) => {
  try {
    await bootstrapSchema(c.env);
    return c.json({ success: true, message: "Universal schema bootstrapped." });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, { status: 500 });
  }
});

// ─── Admin: Register Group Role ────────────────────────────────────────────────

app.post("/admin/group-role", async (c) => {
  try {
    const { chatGroupId, role, platform } = await c.req.json<{
      chatGroupId: string;
      role: string;
      platform: string;
    }>();
    if (!chatGroupId || !role || !platform)
      return c.json(
        { error: "chatGroupId, role, platform required." },
        { status: 400 },
      );
    const db = getTursoClient(c.env);
    await db.execute({
      sql: `INSERT INTO group_roles (chat_group_id, group_role, platform) VALUES (?, ?, ?)
            ON CONFLICT(chat_group_id) DO UPDATE SET group_role = excluded.group_role`,
      args: [chatGroupId, role, platform],
    });
    return c.json({ success: true, chatGroupId, role, platform });
  } catch (err: any) {
    return c.json({ error: err.message }, { status: 500 });
  }
});

// ─── Shared Webhook Processor ─────────────────────────────────────────────────
//
// All platform webhooks share the same pipeline:
//   1. Parse platform message
//   2. Resolve agent type from ?agent= param (default: "order")
//   3. Resolve RBAC role for this chat group
//   4. Call the agent's handleWebhook()
//   5. Send reply via platform adapter

async function processWebhook(
  env: Env,
  platform: "telegram" | "whatsapp" | "slack",
  agentType: AgentType,
  chatId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<string> {
  const agent = (await getAgent(env, agentType, "main")) as any;
  await agent.syncGroupRoles();
  // IMPORTANT: resolveGroupRole and handleWebhook are Durable Object RPC calls.
  // They return RpcPromise — must be awaited or Hono will try to serialize the
  // raw unresolved promise object and throw "Could not serialize RpcPromise".
  const role: GroupRole = await agent.resolveGroupRole(chatId);
  return await agent.handleWebhook({
    source: platform,
    chatId,
    userId,
    userName,
    text,
    role,
    agentType,
  });
}

// ─── Telegram Webhook ─────────────────────────────────────────────────────────

app.post("/webhook/telegram", async (c) => {
  try {
    const body = await c.req.json();
    const botUsername = c.env.TELEGRAM_BOT_USERNAME || "TarBot";
    const parsed = parseTelegramUpdate(body, botUsername);
    if (!parsed) return c.json({ ok: true });

    const { chatId, userId, userName, text } = parsed;
    const agentType = resolveAgentType(c.req.raw, "order");

    const reply = await processWebhook(
      c.env,
      "telegram",
      agentType,
      chatId,
      userId,
      userName,
      text,
    );
    await sendTelegramMessage(chatId, reply, c.env.TELEGRAM_BOT_TOKEN);
    return c.json({ ok: true, agent: agentType, reply });
  } catch (err: any) {
    console.error("[/webhook/telegram]", err.message);
    return c.json({ error: err.message }, { status: 500 });
  }
});

// ─── WhatsApp Webhook ─────────────────────────────────────────────────────────

app.get("/webhook/whatsapp", (c) => {
  const url = new URL(c.req.url);
  const response = verifyWhatsAppChallenge(url, c.env.WHATSAPP_VERIFY_TOKEN);
  return response ?? c.json({ error: "Forbidden" }, { status: 403 });
});

app.post("/webhook/whatsapp", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseWhatsAppMessage(body);
    if (!parsed) return c.json({ ok: true });

    const { from, text } = parsed;
    const agentType = resolveAgentType(c.req.raw, "order");

    const reply = await processWebhook(
      c.env,
      "whatsapp",
      agentType,
      from,
      from,
      from,
      text,
    );
    await sendWhatsAppMessage(
      from,
      reply,
      c.env.WHATSAPP_PHONE_NUMBER_ID,
      c.env.WHATSAPP_ACCESS_TOKEN,
    );
    return c.json({ ok: true, agent: agentType, reply });
  } catch (err: any) {
    console.error("[/webhook/whatsapp]", err.message);
    return c.json({ error: err.message }, { status: 500 });
  }
});

// ─── Slack Webhook ────────────────────────────────────────────────────────────

app.post("/webhook/slack", async (c) => {
  try {
    const rawBody = await c.req.text();
    const isValid = await verifySlackSignature(
      c.req.raw,
      rawBody,
      c.env.SLACK_SIGNING_SECRET,
    );
    if (!isValid) return c.json({ error: "Unauthorized" }, { status: 401 });

    const body = JSON.parse(rawBody) as import("./types").SlackEvent;
    const parsed = parseSlackEvent(body);
    if (!parsed) return c.json({ ok: true });
    if (parsed.isChallenge) return c.json({ challenge: parsed.challenge });

    const { channelId, userId, text } = parsed;
    const agentType = resolveAgentType(c.req.raw, "order");

    const reply = await processWebhook(
      c.env,
      "slack",
      agentType,
      channelId,
      userId,
      userId,
      text,
    );
    await sendSlackMessage(channelId, reply, c.env.SLACK_BOT_TOKEN);
    return c.json({ ok: true, agent: agentType, reply });
  } catch (err: any) {
    console.error("[/webhook/slack]", err.message);
    return c.json({ error: err.message }, { status: 500 });
  }
});

// ─── Agent WebSocket + HTTP Routing ───────────────────────────────────────────
// /agents/:AgentClass/:instanceName → routeAgentRequest handles WS upgrade

app.all("/agents/*", async (c) => {
  const response = await routeAgentRequest(c.req.raw, c.env);
  if (response) return response;
  return c.json({ error: "No agent found at this path." }, { status: 404 });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.all("*", (c) =>
  c.json(
    {
      error: "Not found",
      routes: [
        "GET /health",
        "POST /admin/bootstrap",
        "POST /admin/group-role",
        "POST /webhook/telegram?agent=order",
        "POST /webhook/whatsapp?agent=order",
        "POST /webhook/slack?agent=order",
        "/agents/:AgentClass/:instanceName",
      ],
    },
    { status: 404 },
  ),
);

// ─── Exports (Wrangler picks up all Durable Object classes from here) ─────────

export {
  CatalogAgent,
  ChatAgent,
  DriverAgent,
  FleetAgent,
  InventoryAgent,
  OrderAgent,
  SearchAgent,
  StoreAgent,
  TaskAgent,
  UserAgent
};
export default app;
