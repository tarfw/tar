/**
 * Channel index — unified channel routing.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';
import { handleTelegramUpdate, sendTelegramMessage } from './telegram';
import { handleSlackEvent, sendSlackMessage } from './slack';
import { handleDiscordEvent, sendDiscordMessage } from './discord';

export type { ChannelMessage, ChannelConfig, ChannelResponse };

/**
 * Route an incoming message to the correct platform handler.
 */
export async function handleChannelMessage(
  platform: string,
  payload: any,
  env: { DB?: D1Database }
): Promise<ChannelMessage | null> {
  switch (platform) {
    case 'telegram': {
      const res = await handleTelegramUpdate(payload, env);
      return res ? res.message : null;
    }
    case 'slack':
      return handleSlackEvent(payload);
    case 'discord':
      return handleDiscordEvent(payload);
    default:
      console.warn(`[Channel] Unknown platform: ${platform}`);
      return null;
  }
}

/**
 * Send a response via the correct platform.
 */
export async function sendChannelMessage(
  platform: string,
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
  switch (platform) {
    case 'telegram':
      return sendTelegramMessage(config, response);
    case 'slack':
      return sendSlackMessage(config, response);
    case 'discord':
      return sendDiscordMessage(config, response);
    default:
      console.warn(`[Channel] Unknown platform: ${platform}`);
      return false;
  }
}

/**
 * Look up channel config from form table.
 */
export async function getChannelConfig(
  platform: string,
  scope: string
): Promise<ChannelConfig | null> {
  const { executeRead } = await import('../lib/helpers');
  const result = await executeRead({
    table: 'form',
    type: `channel_${platform}`,
    scope,
    limit: 1,
  });

  const row = result.rows?.[0];
  if (!row) return null;

  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return {
    platform,
    botToken: data?.botToken,
    webhookUrl: data?.webhookUrl,
    appId: data?.appId,
    appSecret: data?.appSecret,
  };
}
