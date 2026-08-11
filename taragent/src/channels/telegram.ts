/**
 * Telegram channel — webhook handler, group → scope mapping, channel-native role management, and motion dispatcher.
 */

import type { ChannelMessage, ChannelConfig, ChannelResponse } from './types';
import { executeWorkspaceTursoQuery } from '../lib/db';
import { getOrCreateWorkspaceDb } from '../lib/workspace-db';

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = 32;

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = "";
  for (let i = 0; i < len; i++) {
    const rand = Math.floor(Math.random() * ENCODING_LEN);
    str += ENCODING.charAt(rand);
  }
  return str;
}

export function generateUlid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

export function generateEntityId(type: string): string {
  const prefixMap: Record<string, string> = {
    product: 'prd', order: 'ord', booking: 'bkg', customer: 'cus',
    staff: 'stf', invoice: 'inv', expense: 'exp', deal: 'dea',
    contract: 'ctr', asset: 'ast', ticket: 'tkt', project: 'prj',
    payslip: 'pay', purchase: 'pur', workorder: 'woe', shipment: 'shp',
    listing: 'lst', setting: 'set', motion: 'mot', inbox: 'ibx'
  };
  const prefix = prefixMap[type] || type.slice(0, 3).toLowerCase();
  return `${prefix}${generateUlid(Date.now())}`;
}

export interface TelegramProcessResult {
  message: ChannelMessage;
  response: ChannelResponse;
}

function getMessageBody(msg: any): string {
  if (msg.text !== undefined) return msg.text;
  if (msg.caption !== undefined) return msg.caption;
  if (msg.photo) return '[photo message]';
  if (msg.video) return '[video message]';
  if (msg.voice) return '[voice message]';
  if (msg.document) return '[document message]';
  if (msg.sticker) return '[sticker message]';
  return '';
}

function toWorkspaceScope(raw: string): string {
  if (!raw) return 'w:default';
  const clean = raw.trim().replace(/^[tw]:/, '');
  return `w:${clean}`;
}

/**
 * Handle incoming Telegram webhook update (Flue Framework Compliant).
 */
export async function handleTelegramUpdate(
  update: any,
  env: { DB?: D1Database }
): Promise<TelegramProcessResult | null> {
  const message = update.message || update.channel_post || update.business_message;
  if (!message) return null;

  const chatId = message.chat?.id?.toString();
  const userId = message.from?.id?.toString() || 'unknown';
  const username = message.from?.username ? `@${message.from.username}` : '';
  const firstName = message.from?.first_name || 'User';
  const userName = username || firstName;
  const userHandle = username || `@${firstName.toLowerCase().replace(/\s+/g, '_')}`;
  const text = getMessageBody(message).trim();

  if (!chatId || !text) return null;

  const channelMsg: ChannelMessage = {
    platform: 'telegram',
    chatId,
    userId,
    userName,
    content: text,
    messageId: message.message_id?.toString(),
  };

  // Ensure D1 channels & members tables exist
  await initTables(env);

  let responseText = '';

  // Parse Slash Commands — locate command token even if prefixed by @bot_username
  const tokens = text.split(/\s+/);
  const cmdIndex = tokens.findIndex(t => t.startsWith('/') || t.includes('/link') || t.includes('/role') || t.includes('/team') || t.includes('/remove'));

  if (cmdIndex !== -1 || text.includes('/')) {
    const parts = cmdIndex !== -1 ? tokens.slice(cmdIndex) : tokens;
    const command = (parts[0] || '').toLowerCase().replace(/@\w+/, '');

    // 1. /link <scope> [role:<default_role>]
    if (command === '/link' || command.startsWith('/link')) {
      const targetScopeRaw = parts[1] || '';
      if (!targetScopeRaw) {
        responseText = '⚠️ Usage: /link <workspace_scope> (e.g. /link velvet-brew)';
      } else {
        const scope = toWorkspaceScope(targetScopeRaw);
        const subdomain = targetScopeRaw.trim().replace(/^[tw]:/, '').toLowerCase();
        const defaultRole = parts.find(p => p.startsWith('role:'))?.split(':')[1] || 'staff';
        const groupName = message.chat?.title || 'Telegram Group';

        if (env.DB) {
          // 1. Link channel in D1
          await env.DB.prepare(
            `INSERT INTO channels (chat_id, scope, name, platform, created_at)
             VALUES (?, ?, ?, 'telegram', ?)
             ON CONFLICT(chat_id) DO UPDATE SET scope = excluded.scope`
          ).bind(chatId, scope, groupName, new Date().toISOString()).run();

          // 2. Register workspace in D1 workspaces directory table
          await env.DB.prepare(
            `INSERT INTO workspaces (subdomain, scope, user_id, created_at, type, name)
             VALUES (?, ?, 'telegram', ?, 'business', ?)
             ON CONFLICT(subdomain) DO UPDATE SET scope = excluded.scope`
          ).bind(subdomain, scope, new Date().toISOString(), groupName).run().catch(() => {});

          // 3. Auto-provision per-workspace Turso DB if platform token is present
          if ((env as any).TURSO_PLATFORM_TOKEN) {
            try {
              const wsDb = await getOrCreateWorkspaceDb(env.DB, subdomain, scope, (env as any).TURSO_PLATFORM_TOKEN);
              console.log(`[Telegram Link] Provisioned Turso DB for ${subdomain}: ${wsDb.url}`);
            } catch (err) {
              console.warn(`[Telegram Link] Warning provisioning Turso DB for ${subdomain}:`, err);
            }
          }
        }

        responseText = `✅ Group <b>${groupName}</b> linked to workspace <b>${scope}</b> (Default Role: <code>${defaultRole}</code>).`;
      }
    }

    // 2. /role <@handle> <role>
    else if (command === '/role' || command.startsWith('/role')) {
      const targetHandle = parts[1] || '';
      const newRole = (parts[2] || 'staff').toLowerCase();

      if (!targetHandle || !targetHandle.startsWith('@')) {
        responseText = '⚠️ Usage: /role @username <role> (e.g. /role @charlie_waiter manager)';
      } else {
        const rawScope = await getScopeForChat(env, chatId);
        if (!rawScope || rawScope === 'unassigned') {
          responseText = '⚠️ Group not linked to a workspace. Please run /link <workspace> first.';
        } else if (env.DB) {
          const scope = toWorkspaceScope(rawScope);
          const memberId = `${scope}:${targetHandle.toLowerCase()}`;
          await env.DB.prepare(
            `INSERT INTO members (id, scope, handle, role, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at`
          ).bind(memberId, scope, targetHandle.toLowerCase(), newRole, new Date().toISOString()).run();

          responseText = `⭐ <b>${targetHandle}</b> assigned role <b>${newRole}</b> in <b>${scope}</b>.`;
        }
      }
    }

    // 3. /team
    else if (command === '/team' || command.startsWith('/team')) {
      const rawScope = await getScopeForChat(env, chatId);
      if (!rawScope || rawScope === 'unassigned') {
        responseText = '⚠️ Group not linked to a workspace. Please run /link <workspace> first.';
      } else {
        const scope = toWorkspaceScope(rawScope);
        const members = await getMembersForScope(env, scope);
        if (members.length === 0) {
          responseText = `👥 <b>${scope}</b> Team Roles:\n<i>(No explicit member roles assigned yet. Group members inherit default role <code>staff</code>)</i>.`;
        } else {
          const listStr = members.map(m => {
            const icon = m.role === 'admin' ? '👑' : m.role === 'manager' ? '⭐' : '🔹';
            return `${icon} ${m.handle} — <i>${m.role}</i>`;
          }).join('\n');
          responseText = `👥 <b>${scope}</b> Team Roles:\n${listStr}`;
        }
      }
    }

    // 4. /remove <@handle>
    else if (command === '/remove' || command.startsWith('/remove')) {
      const targetHandle = parts[1] || '';
      if (!targetHandle || !targetHandle.startsWith('@')) {
        responseText = '⚠️ Usage: /remove @username';
      } else {
        const rawScope = await getScopeForChat(env, chatId);
        if (!rawScope || rawScope === 'unassigned') {
          responseText = '⚠️ Group not linked to a workspace.';
        } else if (env.DB) {
          const scope = toWorkspaceScope(rawScope);
          await env.DB.prepare(
            `DELETE FROM members WHERE scope = ? AND LOWER(handle) = ?`
          ).bind(scope, targetHandle.toLowerCase()).run();

          responseText = `🚫 Access revoked for <b>${targetHandle}</b> in <b>${scope}</b>.`;
        }
      }
    }

    // 5. Help or unknown slash command
    else {
      responseText = `🤖 <b>TAR Bot Commands</b>:\n• <code>/link &lt;scope&gt;</code> — Link group to workspace\n• <code>/role @user &lt;role&gt;</code> — Assign staff/manager/admin role\n• <code>/team</code> — View team member roles\n• <code>/remove @user</code> — Revoke member access`;
    }
  }

  // Handle Natural Language Event Motion & OKF Data Prompts
  else {
    const rawScope = await getScopeForChat(env, chatId);
    if (!rawScope || rawScope === 'unassigned') {
      responseText = '⚠️ Group not linked to a workspace. An owner can run /link velvet-brew to link this group.';
    } else {
      const scope = toWorkspaceScope(rawScope);
      const userRole = await getUserRole(env, scope, userHandle);
      const lowerText = text.toLowerCase();

      // Case A: Contact / Customer Creation (e.g. "Add contact tarbee", "Create customer John Doe")
      if (lowerText.includes('contact') || lowerText.includes('customer')) {
        const nameClean = text.replace(/add|create|new|contact|customer/gi, '').trim() || 'New Contact';
        const phoneMatch = text.match(/(\+?\d[\d\s-]{7,}\d)/);
        const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : null;
        const contactName = phoneMatch ? nameClean.replace(phoneMatch[0], '').trim() : nameClean;

        const cusId = generateEntityId('customer');
        const motId = generateEntityId('motion');
        const nowUnix = Math.floor(Date.now() / 1000);

        if (env.DB) {
          // 1. Create matter customer entity
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
             VALUES (?, 'customer', ?, NULL, 'active', ?, NULL, NULL, ?, ?, ?)`,
            [cusId, contactName, JSON.stringify({ name: contactName, phone, added_by: userHandle }), scope, nowUnix, nowUnix]
          );

          // 2. Log motion event linking to matter entity ID
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO motion (id, type, ref, data, by, at, scope)
             VALUES (?, 'change', ?, ?, ?, ?, ?)`,
            [motId, cusId, JSON.stringify({ event: 'created', entity_type: 'customer', title: contactName }), userHandle, nowUnix, scope]
          );
        }

        responseText = `👤 Contact <b>${contactName}</b> saved to customer directory in <b>${scope}</b> (ID: <code>${cusId}</code>).`;
      }

      // Case A2: Item / Product Creation (e.g. "Add item Steak $25", "Create product Espresso $4.50")
      else if (lowerText.includes('item') || lowerText.includes('product') || lowerText.startsWith('add product')) {
        const dollarMatch = text.match(/\$(\d+(\.\d+)?)/);
        const price = dollarMatch ? parseFloat(dollarMatch[1]) : 0;
        const nameClean = text.replace(/add|create|new|item|product|stock/gi, '').replace(/\$\d+(\.\d+)?/, '').trim() || 'New Item';

        const prdId = generateEntityId('product');
        const motId = generateEntityId('motion');
        const nowUnix = Math.floor(Date.now() / 1000);

        if (env.DB) {
          // 1. Create matter product entity
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
             VALUES (?, 'product', ?, ?, 'active', ?, NULL, NULL, ?, ?, ?)`,
            [prdId, nameClean, price, JSON.stringify({ name: nameClean, price, added_by: userHandle }), scope, nowUnix, nowUnix]
          );

          // 2. Log motion event linking to product entity ID
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO motion (id, type, ref, data, by, at, scope)
             VALUES (?, 'change', ?, ?, ?, ?, ?)`,
            [motId, prdId, JSON.stringify({ event: 'created', entity_type: 'product', title: nameClean, price }), userHandle, nowUnix, scope]
          );
        }

        responseText = `📦 Item <b>${nameClean}</b> ($${price}) added to catalog in <b>${scope}</b> (ID: <code>${prdId}</code>).`;
      }

      // Case B: Refund Motion (Staff vs Manager / Admin)
      else if (lowerText.includes('refund') || lowerText.includes('return')) {
        const amountMatch = text.match(/\$?(\d+(\.\d+)?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
        const reason = text.replace(/refund|return/gi, '').replace(/\$?(\d+(\.\d+)?)/, '').trim() || 'Customer refund request';

        const ordId = generateEntityId('order');
        const nowUnix = Math.floor(Date.now() / 1000);

        if (userRole === 'staff') {
          // Staff requires owner approval -> Create matter order + inbox task
          const ibxId = generateEntityId('inbox');
          const title = `Stock Refund Request: $${amount}`;
          const dataJson = JSON.stringify({ amount, reason, requested_by: userHandle, order_id: ordId });

          if (env.DB) {
            // 1. Insert matter order record (refund_pending)
            await executeWorkspaceTursoQuery(
              env.DB, env, scope,
              `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
               VALUES (?, 'order', 'Refund Request', ?, 'refund_pending', ?, NULL, NULL, ?, ?, ?)`,
              [ordId, amount, dataJson, scope, nowUnix, nowUnix]
            );

            // 2. Insert inbox task referencing the order ID
            await executeWorkspaceTursoQuery(
              env.DB, env, scope,
              `INSERT INTO inbox (id, scope, type, title, status, ref, data, due, at)
               VALUES (?, ?, 'refund', ?, 'pending_approval', ?, ?, NULL, ?)`,
              [ibxId, scope, title, ordId, dataJson, nowUnix]
            );
          }
          responseText = `⏳ Refund request ($${amount}) submitted to <b>Linear Inbox</b> for Owner Approval (Ref: <code>${ibxId}</code>).`;
        } else {
          // Manager / Admin -> Execute immediately
          const motId = generateEntityId('motion');
          const dataJson = JSON.stringify({ order_id: ordId, amount, reason, approved_by: userHandle, status: 'approved' });

          if (env.DB) {
            // 1. Insert matter order record (refunded)
            await executeWorkspaceTursoQuery(
              env.DB, env, scope,
              `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
               VALUES (?, 'order', 'Refund Processed', ?, 'refunded', ?, NULL, NULL, ?, ?, ?)`,
              [ordId, -amount, dataJson, scope, nowUnix, nowUnix]
            );

            // 2. Insert motion event referencing the order ID
            await executeWorkspaceTursoQuery(
              env.DB, env, scope,
              `INSERT INTO motion (id, type, ref, data, by, at, scope)
               VALUES (?, 'refund', ?, ?, ?, ?, ?)`,
              [motId, ordId, dataJson, userHandle, nowUnix, scope]
            );
          }
          responseText = `✅ Refund ($${amount}) approved & processed by <b>${userHandle}</b> (${userRole}).`;
        }
      }

      // Case C: Sale / Order Motion (e.g., "Table 4: 2x Steak $85 Cash")
      else if (/\$?(\d+)/.test(text) || lowerText.includes('table') || lowerText.includes('sale') || lowerText.includes('order')) {
        // Extract explicit $ amount first (e.g. $85), otherwise strip "Table X" prefix first
        const dollarMatch = text.match(/\$(\d+(\.\d+)?)/);
        let total = 0;
        if (dollarMatch) {
          total = parseFloat(dollarMatch[1]);
        } else {
          const textWithoutTable = text.replace(/table\s*\d+:?/i, '');
          const amountMatch = textWithoutTable.match(/(\d+(\.\d+)?)/);
          total = amountMatch ? parseFloat(amountMatch[1]) : 50;
        }

        const items = text.replace(/\$\d+(\.\d+)?/, '').replace(/table\s*\d+:?/i, '').replace(/cash|card|paid/i, '').trim() || 'Items';
        const paymentMethod = lowerText.includes('cash') ? 'Cash' : lowerText.includes('card') ? 'Card' : 'Cash';
        const saleNum = Math.floor(1000 + Math.random() * 9000);

        const ordId = generateEntityId('order');
        const motId = generateEntityId('motion');
        const nowUnix = Math.floor(Date.now() / 1000);
        const dataJson = JSON.stringify({ sale_id: saleNum, items, total, payment_method: paymentMethod, order_id: ordId });

        if (env.DB) {
          // 1. Insert matter order record (active)
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO matter (id, type, title, value, status, data, file, role, scope, at, updated)
             VALUES (?, 'order', ?, ?, 'active', ?, NULL, NULL, ?, ?, ?)`,
            [ordId, `Sale #${saleNum}`, total, dataJson, scope, nowUnix, nowUnix]
          );

          // 2. Insert motion event referencing the order ID
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO motion (id, type, ref, data, by, at, scope)
             VALUES (?, 'sale', ?, ?, ?, ?, ?)`,
            [motId, ordId, dataJson, userHandle, nowUnix, scope]
          );
        }

        responseText = `✅ Sale #${saleNum} ($${total}) logged by <b>${userHandle}</b> (Order ID: <code>${ordId}</code>).`;
      }

      // Case D: General Activity Fallback
      else {
        const motId = generateEntityId('motion');
        const nowUnix = Math.floor(Date.now() / 1000);
        if (env.DB) {
          await executeWorkspaceTursoQuery(
            env.DB, env, scope,
            `INSERT INTO motion (id, type, ref, data, by, at, scope)
             VALUES (?, 'activity', NULL, ?, ?, ?, ?)`,
            [motId, JSON.stringify({ text, platform: 'telegram' }), userHandle, nowUnix, scope]
          );
        }
        responseText = `🤖 Logged event from <b>${userHandle}</b>: "${text}" in workspace <b>${scope}</b>.`;
      }
    }
  }

  return {
    message: channelMsg,
    response: {
      chatId,
      text: responseText,
      replyToMessageId: message.message_id?.toString(),
    },
  };
}

/**
 * Initialize D1 channels and members table schema if missing.
 */
async function initTables(env: { DB?: D1Database }): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS channels (
        chat_id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        name TEXT,
        platform TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        handle TEXT NOT NULL,
        role TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
  } catch (e) {
    console.warn('[Telegram DB Setup] Exception creating tables:', e);
  }
}

/**
 * Helper to get linked workspace scope for a chat_id.
 */
async function getScopeForChat(env: { DB?: D1Database }, chatId: string): Promise<string | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare('SELECT scope FROM channels WHERE chat_id = ?').bind(chatId).first();
  return (row?.scope as string) || null;
}

/**
 * Helper to get user's role for a scope.
 */
async function getUserRole(env: { DB?: D1Database }, scope: string, handle: string): Promise<string> {
  if (!env.DB || !handle) return 'staff';
  const row = await env.DB.prepare(
    'SELECT role FROM members WHERE scope = ? AND LOWER(handle) = ?'
  ).bind(scope, handle.toLowerCase()).first();
  return (row?.role as string) || 'staff';
}

/**
 * Helper to list all team members for a scope.
 */
async function getMembersForScope(env: { DB?: D1Database }, scope: string): Promise<Array<{ handle: string; role: string }>> {
  if (!env.DB) return [];
  const result = await env.DB.prepare('SELECT handle, role FROM members WHERE scope = ?').bind(scope).all();
  return (result.results || []) as Array<{ handle: string; role: string }>;
}

/**
 * Send a message via Telegram Bot API with automatic fallback for HTML/Reply errors.
 */
export async function sendTelegramMessage(
  config: ChannelConfig,
  response: ChannelResponse
): Promise<boolean> {
  if (!config.botToken) return false;

  const targetChatId = !isNaN(Number(response.chatId)) ? Number(response.chatId) : response.chatId;
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: response.text,
        parse_mode: 'HTML',
      }),
    });
    const resultText = await res.text();
    console.log('[Telegram Outbound Response]:', res.status, resultText);
    if (res.ok) return true;

    // Fallback plain text if HTML parsing failed
    const plainText = response.text.replace(/<[^>]*>/g, '');
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: plainText,
      }),
    });
    return fallbackRes.ok;
  } catch (e) {
    console.error('[Telegram Outbound Exception]:', e);
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
