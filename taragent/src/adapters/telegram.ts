// src/adapters/telegram.ts — Telegram Bot API adapter

import type { TelegramUpdate } from "../types";

// ─── Parse ────────────────────────────────────────────────────────────────────

export interface TelegramParsed {
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  isGroup: boolean;
  mentionsBot: boolean;
}

/**
 * Extracts relevant fields from a Telegram Update object.
 * Returns null if the update has no actionable message.
 */
export function parseTelegramUpdate(
  body: TelegramUpdate,
  botUsername: string,
): TelegramParsed | null {
  const msg = body.message;
  if (!msg?.text) return null;

  const chatId = String(msg.chat.id);
  const userId = String(msg.from?.id ?? "unknown");
  const userName = msg.from?.first_name ?? "Staff";
  const text = msg.text.trim();
  const chatType = msg.chat.type;
  const isGroup = chatType === "group" || chatType === "supergroup";

  const mentionTag = `@${botUsername}`;
  const mentionsBot = text.includes(mentionTag);

  // Strip the bot mention from the text before processing
  const cleanText = text.replace(mentionTag, "").trim();
  if (!cleanText) return null;

  return { chatId, userId, userName, text: cleanText, isGroup, mentionsBot };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/** Sends a text message to a Telegram chat via Bot API. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  token: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[Telegram] sendMessage failed: ${err}`);
  }
}
