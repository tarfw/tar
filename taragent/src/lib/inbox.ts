/**
 * Inbox support — per-user Turso DBs for personal timeline.
 * Each user has a Turso DB at u:{userId} called their Inbox.
 * All tasks, orders, deliveries, and actions assigned to them land here.
 */

import { dbGet, dbAll, dbRun } from './db';

/**
 * Write a motion event to a user's Inbox Turso DB.
 * Called by DOs when they write motion events.
 */
export async function writeToInbox(
  userId: string,
  motion: {
    stream: string;
    action: number;
    data: Record<string, any>;
    scope?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const nextSeqRes = await dbGet(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
    [motion.stream]
  );
  const seq = Number(nextSeqRes?.next ?? 1);

  await dbRun(
    `INSERT INTO motion (stream, seq, action, data, time) VALUES (?, ?, ?, ?, ?)`,
    [motion.stream, seq, motion.action, JSON.stringify(motion.data), now]
  );
}

/**
 * Query a user's timeline — all motions assigned to them across workspaces.
 * Single query to user's Turso DB, ~20ms latency.
 */
export async function getUserTimeline(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    since?: string;
  } = {}
): Promise<{ rows: any[]; count: number }> {
  let sql = 'SELECT * FROM motion WHERE 1=1';
  const args: any[] = [];

  if (options.since) {
    sql += ' AND time > ?';
    args.push(options.since);
  }

  sql += ' ORDER BY time DESC';
  sql += ' LIMIT ? OFFSET ?';
  args.push(options.limit ?? 50, options.offset ?? 0);

  const rows = await dbAll(sql, args);
  return {
    rows: rows.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    })),
    count: rows.length,
  };
}

/**
 * Write motion events from Workspace to relevant users' Inboxes.
 * Called after workspace operations that affect specific users.
 */
export async function broadcastToInbox(
  scope: string,
  motion: {
    stream: string;
    action: number;
    data: Record<string, any>;
  },
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    await writeToInbox(userId, {
      ...motion,
      data: { ...motion.data, scope },
    });
  }
}

/**
 * Get users who should receive inbox events for a scope.
 * Queries graph table for users linked to the workspace.
 */
export async function getScopeUsers(scope: string): Promise<string[]> {
  const rows = await dbAll(
    `SELECT src FROM graph WHERE tgt = ? AND rel IN ('owner', 'staff', 'member') AND active = 1`,
    [scope]
  );
  return rows.map(r => r.src).filter(Boolean);
}
