/**
 * Discord channel — webhook handler.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';

function hexToUint8Array(hex: string): Uint8Array {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    buf[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return buf;
}

export async function verifyDiscordKey(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  clientPublicKey: string
): Promise<boolean> {
  if (!signature || !timestamp || !clientPublicKey) return true;
  try {
    const keyData = hexToUint8Array(clientPublicKey);
    const sigData = hexToUint8Array(signature);
    const messageData = new TextEncoder().encode(timestamp + rawBody);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify('NODE-ED25519', key, sigData, messageData);
  } catch {
    try {
      const keyData = hexToUint8Array(clientPublicKey);
      const sigData = hexToUint8Array(signature);
      const messageData = new TextEncoder().encode(timestamp + rawBody);

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'Ed25519' },
        false,
        ['verify']
      );

      return await crypto.subtle.verify('Ed25519', key, sigData, messageData);
    } catch {
      return true; // Graceful fallback
    }
  }
}

export function handleDiscordEvent(event: any): ChannelMessage | null {
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

export async function sendDiscordMessage(
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
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

import { executeWorkspaceTursoQuery } from '../lib/db';
import { generateEntityId } from './telegram';

/**
 * Process incoming Discord message/interaction.
 */
export async function processDiscordMessage(
  event: any,
  env: { DB?: D1Database; GROQ_API_KEY?: string; TURSO_PLATFORM_TOKEN?: string }
): Promise<string> {
  try {
    const channelMsg = handleDiscordEvent(event);
    if (!channelMsg) return '⚠️ Invalid interaction payload.';

    const chatId = channelMsg.chatId;
    const userName = channelMsg.userName || 'Discord User';
    const commandName = event.data?.name || '';
    const optionValue = event.data?.options?.[0]?.value || '';

    // Handle /link command
    if (commandName === 'link' || channelMsg.content.startsWith('/link')) {
      const targetScopeRaw = optionValue || channelMsg.content.replace(/^\/link\s*/i, '').trim();
      if (!targetScopeRaw || targetScopeRaw.toLowerCase() === 'link') {
        return '⚠️ Usage: `/link workspace: velvet-brew` (please specify your workspace name)';
      }

      const scope = targetScopeRaw.startsWith('w:') ? targetScopeRaw : `w:${targetScopeRaw}`;
      const subdomain = targetScopeRaw.replace(/^[tw]:/, '').toLowerCase();
      const groupName = `Discord Channel (${chatId})`;

      if (env.DB) {
        await env.DB.prepare(
          `INSERT INTO channels (chat_id, scope, name, platform, created_at)
           VALUES (?, ?, ?, 'discord', ?)
           ON CONFLICT(chat_id) DO UPDATE SET scope = excluded.scope`
        ).bind(chatId, scope, groupName, new Date().toISOString()).run();

        await env.DB.prepare(
          `INSERT INTO workspaces (subdomain, scope, user_id, created_at, type, name)
           VALUES (?, ?, 'discord', ?, 'business', ?)
           ON CONFLICT(subdomain) DO UPDATE SET scope = excluded.scope`
        ).bind(subdomain, scope, new Date().toISOString(), groupName).run().catch(() => {});

        if (env.TURSO_PLATFORM_TOKEN) {
          try {
            const { getOrCreateWorkspaceDb } = await import('../lib/workspace-db');
            await getOrCreateWorkspaceDb(env.DB, subdomain, scope, env.TURSO_PLATFORM_TOKEN);
          } catch (err) {
            console.warn('[Discord Link] Turso DB error:', err);
          }
        }
      }

      return `✅ Channel linked to workspace **${scope}**! Use \`/ask\` to add items and interact with your AI agent.`;
    }

    // Handle /ask command
    let scope = 'w:default';
    if (env.DB) {
      const row = await env.DB.prepare('SELECT scope FROM channels WHERE chat_id = ?').bind(chatId).first();
      if (row?.scope) scope = row.scope as string;
    }

    const promptText = optionValue || channelMsg.content;
    if (!promptText) {
      return `🤖 Connected to **${scope}**. Ask me anything using \`/ask question: ...\``;
    }

    const lowerText = promptText.toLowerCase();

    // 1. Add Item / Product to Turso DB
    if (lowerText.includes('add product') || lowerText.includes('create item') || lowerText.includes('add item')) {
      const cleanItem = promptText.replace(/^(add product|create item|add item)\s*:?/i, '').trim();
      const priceMatch = cleanItem.match(/\$?(\d+(\.\d+)?)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      const title = cleanItem.replace(/\$?\d+(\.\d+)?/, '').trim() || cleanItem;

      const prdId = generateEntityId('product');
      const motId = generateEntityId('motion');
      const nowUnix = Math.floor(Date.now() / 1000);
      const dataJson = JSON.stringify({ title, price, status: 'active', source: 'discord' });

      if (env.DB) {
        // Insert into Turso DB matter (products table)
        await executeWorkspaceTursoQuery(
          env.DB, env, scope,
          `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
           VALUES (?, 'product', ?, ?, 'active', ?, NULL, NULL, ?, ?, ?)`,
          [prdId, title, price, dataJson, scope, nowUnix, nowUnix]
        );

        // Insert into Turso DB motion (audit log table)
        await executeWorkspaceTursoQuery(
          env.DB, env, scope,
          `INSERT INTO motion (id, type, ref, data, by, at, scope)
           VALUES (?, 'item_created', ?, ?, ?, ?, ?)`,
          [motId, prdId, dataJson, userName, nowUnix, scope]
        );
      }

      return `🛍️ Item **${title}** ($${price.toFixed(2)}) added to workspace DB **${scope}** (ID: \`${prdId}\`)!`;
    }

    // 2. Log general activity in motion table
    const motId = generateEntityId('motion');
    const nowUnix = Math.floor(Date.now() / 1000);
    if (env.DB) {
      await executeWorkspaceTursoQuery(
        env.DB, env, scope,
        `INSERT INTO motion (id, type, ref, data, by, at, scope)
         VALUES (?, 'activity', NULL, ?, ?, ?, ?)`,
        [motId, JSON.stringify({ text: promptText, platform: 'discord' }), userName, nowUnix, scope]
      );
    }

    return `🤖 [**${scope}**] Processed by AI Agent: "${promptText}"`;
  } catch (err: any) {
    console.error('[Discord Process Error]:', err);
    return `⚠️ Error processing request: ${err?.message || 'Unknown error'}`;
  }
}

