/**
 * Telegram channel — webhook handler, group → scope mapping via D1.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';
import { executeRead, executeCreate } from '../lib/helpers';

/**
 * Handle incoming Telegram webhook update.
 */
export async function handleTelegramUpdate(
  update: any,
  env: { DB?: D1Database }
): Promise<ChannelMessage | null> {
  const message = update.message || update.channel_post;
  if (!message) return null;

  const chatId = message.chat?.id;
  const userId = message.from?.id?.toString();
  const userName = message.from?.first_name || message.from?.username || 'Unknown';
  const text = message.text || message.caption || '';

  if (!chatId || !userId || !text) return null;

  // Register group if not already mapped
  if (message.chat?.type === 'group' || message.chat?.type === 'supergroup') {
    await registerGroup(env, chatId, message.chat.title || 'Unknown Group', 'telegram');
  }

  return {
    platform: 'telegram',
    chatId: chatId.toString(),
    userId,
    userName,
    content: text,
    messageId: message.message_id?.toString(),
  };
}

/**
 * Register a Telegram group in D1 channels table.
 */
async function registerGroup(
  env: { DB?: D1Database },
  chatId: number,
  name: string,
  platform: string
): Promise<void> {
  if (!env.DB) return;

  const existing = await env.DB.prepare(
    'SELECT 1 FROM channels WHERE chat_id = ?'
  ).bind(chatId).first();

  if (!existing) {
    // Default scope — will be updated when workspace is linked
    await env.DB.prepare(
      'INSERT OR IGNORE INTO channels (chat_id, scope, name, platform, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(chatId, 'unassigned', name, platform, new Date().toISOString()).run();
  }
}

/**
 * Send a message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
  if (!config.botToken) return false;

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const body = {
    chat_id: response.chatId,
    text: response.text,
    reply_to_message_id: response.replyToMessageId,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error('[Telegram] Send failed:', e);
    return false;
  }
}

/**
 * Set Telegram webhook URL.
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    return res.ok;
  } catch (e) {
    console.error('[Telegram] Set webhook failed:', e);
    return false;
  }
}
