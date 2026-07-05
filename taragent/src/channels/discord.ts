/**
 * Discord channel — webhook handler.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';

/**
 * Handle incoming Discord interaction/webhook.
 */
export async function handleDiscordEvent(event: any): Promise<ChannelMessage | null> {
  // Discord interactions (slash commands)
  if (event.type === 2) {
    return {
      platform: 'discord',
      chatId: event.channel_id || 'unknown',
      userId: event.member?.user?.id || event.user?.id || 'unknown',
      userName: event.member?.user?.username || event.user?.username || 'Unknown',
      content: event.data?.options?.[0]?.value || event.data?.name || '',
      messageId: event.id,
    };
  }

  // Discord message events
  if (event.type === 0 && event.content) {
    return {
      platform: 'discord',
      chatId: event.channel_id,
      userId: event.author?.id || 'unknown',
      userName: event.author?.username || 'Unknown',
      content: event.content,
      messageId: event.id,
    };
  }

  return null;
}

/**
 * Send a message via Discord webhook or bot API.
 */
export async function sendDiscordMessage(
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
  // Use webhook URL if provided
  if (config.webhookUrl) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: response.text }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Discord] Webhook send failed:', e);
      return false;
    }
  }

  // Use bot token
  if (config.botToken) {
    const url = `https://discord.com/api/v10/channels/${response.chatId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${config.botToken}`,
        },
        body: JSON.stringify({ content: response.text }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Discord] Bot send failed:', e);
      return false;
    }
  }

  return false;
}
