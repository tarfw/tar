// src/index.ts — TAR Agent main Worker entry point
// Hono router handles all incoming requests and dispatches to:
//   - TarAgent (Cloudflare Agents SDK) for AI processing
//   - Platform-specific webhook adapters (Telegram, WhatsApp, Slack)
//   - routeAgentRequest() for WebSocket connections from clients

import { getAgentByName, routeAgentRequest } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { TarAgent } from "./agent";
import { bootstrapSchema } from "./db";
import type { Env } from "./types";

// Adapters
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

// CORS — allow the React Native app and any dashboard to connect
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "tar-agent",
    timestamp: new Date().toISOString(),
  }),
);

// ─── Admin: Bootstrap DB Schema ────────────────────────────────────────────────
// POST /admin/bootstrap — run once after first deploy to create Turso tables

app.post("/admin/bootstrap", async (c) => {
  try {
    await bootstrapSchema(c.env);
    return c.json({
      success: true,
      message: "Schema bootstrapped successfully.",
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap error]", msg, "Cause:", err?.cause);
    return c.json({ success: false, error: msg }, { status: 500 });
  }
});

// POST /admin/test-trace — insert a test row directly into trace table
app.post("/admin/test-trace", async (c) => {
  try {
    const { createClient } = await import("@libsql/client/web");
    const db = createClient({
      url: c.env.TURSO_URL!,
      authToken: c.env.TURSO_AUTH_TOKEN!,
    });
    const id = `trace_test_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO trace (id, streamid, opcode, delta, payload, scope) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        "test-stream",
        101,
        50,
        JSON.stringify({ item: "test" }),
        "admin",
      ],
    });
    const result = await db.execute("SELECT * FROM trace WHERE id = ?", [id]);
    return c.json({ success: true, row: result.rows[0] });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-trace error]", msg, err?.cause);
    return c.json({ success: false, error: msg }, { status: 500 });
  }
});

// ─── Admin: Register a Group Role ─────────────────────────────────────────────
// POST /admin/group-role — maps a chat group ID to an RBAC role
// Body: { chatGroupId: string, role: string, platform: string }

app.post("/admin/group-role", async (c) => {
  try {
    const { chatGroupId, role, platform } = await c.req.json<{
      chatGroupId: string;
      role: string;
      platform: string;
    }>();

    if (!chatGroupId || !role || !platform) {
      return c.json(
        { error: "chatGroupId, role, and platform are required." },
        { status: 400 },
      );
    }

    // Import here to avoid circular at module level
    const { getTursoClient } = await import("./db");
    const db = getTursoClient(c.env);
    await db.execute({
      sql: `INSERT INTO group_roles (chat_group_id, group_role, platform)
            VALUES (?, ?, ?)
            ON CONFLICT(chat_group_id) DO UPDATE SET group_role = excluded.group_role`,
      args: [chatGroupId, role, platform],
    });

    return c.json({ success: true, chatGroupId, role, platform });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, { status: 500 });
  }
});

// ─── Telegram Webhook ─────────────────────────────────────────────────────────
// POST /webhook/telegram
// Register this URL in @BotFather → Bot Settings → Webhooks

app.post("/webhook/telegram", async (c) => {
  try {
    const body = await c.req.json();
    const botUsername = c.env.TELEGRAM_BOT_USERNAME || "TarBot";

    const parsed = parseTelegramUpdate(body, botUsername);
    if (!parsed) {
      // Not an actionable message (no @mention in group, no text, etc.)
      return c.json({ ok: true });
    }

    const { chatId, userId, userName, text } = parsed;

    // Resolve RBAC role for this chat group
    const agent = await getAgentByName<Env, TarAgent>(c.env.TarAgent, "main");
    await agent.syncGroupRoles();
    const role = await agent.resolveGroupRole(chatId);

    // Process the message
    const reply = await agent.handleWebhook({
      source: "telegram",
      chatId,
      userId,
      userName,
      text,
      role,
    });

    // Send reply back to Telegram
    await sendTelegramMessage(chatId, reply, c.env.TELEGRAM_BOT_TOKEN);

    return c.json({ ok: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/webhook/telegram]", msg);
    return c.json({ error: msg }, { status: 500 });
  }
});

// ─── WhatsApp Webhook ─────────────────────────────────────────────────────────
// GET  /webhook/whatsapp — Meta verification challenge
// POST /webhook/whatsapp — Incoming messages

app.get("/webhook/whatsapp", (c) => {
  const url = new URL(c.req.url);
  const response = verifyWhatsAppChallenge(url, c.env.WHATSAPP_VERIFY_TOKEN);
  return response ?? c.json({ error: "Forbidden" }, { status: 403 });
});

app.post("/webhook/whatsapp", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseWhatsAppMessage(body);

    if (!parsed) {
      // Non-text message (image, voice, etc.) — acknowledge and ignore
      return c.json({ ok: true });
    }

    const { from, text } = parsed;

    // WhatsApp direct messages default to 'delivery' role
    // (customers ordering) — override via admin panel if needed
    const agent = await getAgentByName<Env, TarAgent>(c.env.TarAgent, "main");
    await agent.syncGroupRoles();
    const role = await agent.resolveGroupRole(from);

    const reply = await agent.handleWebhook({
      source: "whatsapp",
      chatId: from,
      userId: from,
      userName: from,
      text,
      role,
    });

    // Reply via WhatsApp Cloud API
    await sendWhatsAppMessage(
      from,
      reply,
      c.env.WHATSAPP_PHONE_NUMBER_ID,
      c.env.WHATSAPP_ACCESS_TOKEN,
    );

    return c.json({ ok: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/webhook/whatsapp]", msg);
    return c.json({ error: msg }, { status: 500 });
  }
});

// ─── Slack Webhook ────────────────────────────────────────────────────────────
// POST /webhook/slack
// Configure as Event Subscription URL in your Slack App settings

app.post("/webhook/slack", async (c) => {
  try {
    const rawBody = await c.req.text();

    // Verify Slack signature before processing
    const isValid = await verifySlackSignature(
      c.req.raw,
      rawBody,
      c.env.SLACK_SIGNING_SECRET,
    );

    if (!isValid) {
      console.warn("[/webhook/slack] Invalid signature");
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as import("./types").SlackEvent;
    const parsed = parseSlackEvent(body);

    if (!parsed) return c.json({ ok: true });

    // Respond to Slack's URL verification challenge immediately
    if (parsed.isChallenge) {
      return c.json({ challenge: parsed.challenge });
    }

    const { channelId, userId, text } = parsed;

    const agent = await getAgentByName<Env, TarAgent>(c.env.TarAgent, "main");
    await agent.syncGroupRoles();
    const role = await agent.resolveGroupRole(channelId);

    const reply = await agent.handleWebhook({
      source: "slack",
      chatId: channelId,
      userId,
      userName: userId,
      text,
      role,
    });

    // Reply in the same Slack channel
    await sendSlackMessage(channelId, reply, c.env.SLACK_BOT_TOKEN);

    return c.json({ ok: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/webhook/slack]", msg);
    return c.json({ error: msg }, { status: 500 });
  }
});

// ─── Agent WebSocket + HTTP Routing ───────────────────────────────────────────
// Handles /agents/:agent/:name — connects React Native / dashboard clients
// via the Cloudflare Agents SDK's routeAgentRequest()

app.all("/agents/*", async (c) => {
  const response = await routeAgentRequest(c.req.raw, c.env);
  if (response) return response;
  return c.json({ error: "No agent found at this path." }, { status: 404 });
});

// ─── Default 404 ──────────────────────────────────────────────────────────────

app.all("*", (c) =>
  c.json(
    {
      error: "Not found",
      hint: "Available routes: GET /health, POST /webhook/telegram, POST /webhook/whatsapp, POST /webhook/slack, /agents/*",
    },
    { status: 404 },
  ),
);

// ─── Exports ──────────────────────────────────────────────────────────────────

// Export the TarAgent class so Wrangler picks it up as a Durable Object
export { TarAgent };

// Default export is the Hono app
export default app;
