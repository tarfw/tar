/**
 * Slack channel — events API handler.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';

/**
 * Handle incoming Slack event.
 */
export async function handleSlackEvent(event: any): Promise<ChannelMessage | null> {
  // Slack URL verification
  if (event.type === 'url_verification') {
    return null;
  }

  // Only handle message events
  if (event.type !== 'message' || event.subtype) return null;

  return {
    platform: 'slack',
    chatId: event.channel,
    userId: event.user || 'unknown',
    userName: event.user || 'Unknown',
    content: event.text || '',
    messageId: event.ts,
    replyTo: event.thread_ts,
  };
}

/**
 * Send a message via Slack API.
 */
export async function sendSlackMessage(
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
  if (!config.botToken) return false;

  const url = 'https://slack.com/api/chat.postMessage';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.botToken}`,
      },
      body: JSON.stringify({
        channel: response.chatId,
        text: response.text,
        thread_ts: response.replyToMessageId,
      }),
    });
    const data = await res.json() as any;
    return data.ok === true;
  } catch (e) {
    console.error('[Slack] Send failed:', e);
    return false;
  }
}
