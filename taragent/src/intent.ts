// src/intent.ts — Lightweight intent pre-classifier
//
// PURPOSE: Avoid spending Groq tokens on messages that can be answered without the LLM.
//
// HOW IT WORKS:
//   Before calling Groq, we run a fast regex/keyword scan on the raw user text.
//   If the intent is clearly "read-only / greeting / unclear", we short-circuit
//   and return a static or templated reply — zero LLM tokens consumed.
//
// TOKEN SAVINGS:
//   A typical Groq call costs ~1,200 tokens:
//     - system prompt    ~300 tokens
//     - history (10 msg) ~500 tokens
//     - tool schemas     ~400 tokens
//   Skipping LLM for ~30% of messages cuts token usage by roughly 360 tokens/request.

export type IntentClass =
  | "ACTION" // Calls a tool — must go to LLM
  | "QUERY" // Read-only question — may skip LLM
  | "GREETING" // Hello / thanks — skip LLM entirely
  | "AMBIGUOUS"; // Not enough signal — send to LLM with trimmed context

// ─────────────────────────────────────────────────────────────────────────────
// Keyword maps — ordered from most-specific to least-specific

const ACTION_KEYWORDS = [
  // Inventory mutations
  "received",
  "restock",
  "update",
  "add stock",
  "out of",
  "86",
  "eighty-six",
  "waste",
  "spoiled",
  "expired",
  "throw",
  "purchase order",
  "order from",
  // Order mutations
  "create order",
  "new order",
  "place order",
  "cancel order",
  "void",
  "refund",
  "delivered",
  "picked up",
  "out for delivery",
  "mark as",
  // Staff / maintenance mutations
  "add employee",
  "hire",
  "time off",
  "day off",
  "maintenance",
  "broken",
  "not working",
  "ticket",
  "repair",
  // Platform control
  "pause",
  "resume",
  "close",
  "open store",
];

const QUERY_KEYWORDS = [
  "what",
  "how many",
  "show",
  "list",
  "get",
  "check",
  "status",
  "sales",
  "schedule",
  "who is",
  "which",
  "menu",
  "available",
];

const GREETING_KEYWORDS = [
  "hi",
  "hello",
  "hey",
  "thanks",
  "thank you",
  "ok",
  "okay",
  "got it",
  "sure",
];

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the intent of a raw user message.
 * Call this BEFORE the LLM to decide whether to skip it.
 *
 * @param text — raw user input (with @mentions already stripped)
 * @returns IntentClass
 */
export function classifyIntent(text: string): IntentClass {
  const lower = text.toLowerCase().trim();

  // Short messages (≤3 words) that aren't commands are greetings
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 3) {
    if (GREETING_KEYWORDS.some((kw) => lower.includes(kw))) return "GREETING";
  }

  // Check for clear action signals first (higher priority)
  if (ACTION_KEYWORDS.some((kw) => lower.includes(kw))) return "ACTION";

  // Then read-only queries
  if (QUERY_KEYWORDS.some((kw) => lower.startsWith(kw) || lower.includes(kw))) {
    return "QUERY";
  }

  return "AMBIGUOUS";
}

/**
 * Static replies for greetings — no LLM needed.
 */
export function greetingReply(userName: string): string {
  return `👋 Hey ${userName}! I'm TarBot. Tell me what you need — inventory update, order status, maintenance ticket, or anything else.`;
}

/**
 * Builds a TRIMMED message array for AMBIGUOUS intents.
 * Instead of loading 10 history messages, we only load 4.
 * This saves ~300 tokens while still giving some context.
 */
export const AMBIGUOUS_HISTORY_LIMIT = 4;
export const ACTION_HISTORY_LIMIT = 10;
export const QUERY_HISTORY_LIMIT = 6;
