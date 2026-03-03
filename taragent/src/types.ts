// src/types.ts — Shared TypeScript types for TAR Agent

// ─── Environment ──────────────────────────────────────────────────────────────

export interface Env {
  // Cloudflare Agents SDK namespace
  TarAgent: any;

  // Groq AI (OpenAI-compatible)
  GROQ_API_KEY: string;
  GROQ_BASE_URL: string;
  GROQ_MODEL: string;

  // Turso database
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;

  // Telegram
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME: string;

  // WhatsApp Cloud API (Meta)
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_VERIFY_TOKEN: string;

  // Slack
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export interface AgentState {
  /** Last known group-to-role mappings (refreshed from Turso periodically) */
  groupRoles: Record<string, GroupRole>;
  /** Active order IDs being tracked in-memory */
  activeOrders: string[];
  /** Timestamp of last state sync with Turso */
  lastSync: number;
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────

export type GroupRole =
  | "management"
  | "kitchen"
  | "front_of_house"
  | "delivery"
  | "default";

// ─── Chat / Webhook ───────────────────────────────────────────────────────────

export type WebhookSource = "telegram" | "whatsapp" | "slack";

export interface ChatContext {
  source: WebhookSource;
  /** Unique chat/channel/group identifier from the platform */
  chatId: string;
  /** Unique user identifier from the platform */
  userId: string;
  /** Display name of the user */
  userName: string;
  /** Raw text message sent by the user */
  text: string;
  /** Role resolved from group mapping */
  role: GroupRole;
}

// ─── AI Tool Calls ────────────────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ─── Turso DB Rows ────────────────────────────────────────────────────────────

export interface GroupRoleRow {
  chat_group_id: string;
  group_role: GroupRole;
  platform: WebhookSource;
}

export interface ConversationRow {
  id: number;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ─── Telegram Types ────────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string; title?: string };
    text?: string;
  };
}

// ─── WhatsApp Types ────────────────────────────────────────────────────────────

export interface WhatsAppWebhook {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          text?: { body: string };
          type: string;
        }>;
      };
    }>;
  }>;
}

// ─── Slack Types ──────────────────────────────────────────────────────────────

export interface SlackEvent {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    channel: string;
    user: string;
    text: string;
    bot_id?: string;
  };
}
