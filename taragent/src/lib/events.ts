/**
 * Events + Inbox Rule Engine
 *
 * Events: append-only writes to the motion table (sales, tickets, attendance, etc.)
 * Inbox: tasks auto-created from events via rule engine (kitchen tickets, restock alerts, etc.)
 */

import { dbContext } from './db';
import { executeCreate, executeRead } from './helpers';

// ── Event types ─────────────────────────────────────────────────────

export interface EventData {
  type: string;
  data: Record<string, any>;
  created_by?: string;
  scope: string;
}

// ── Write event to motion table ─────────────────────────────────────

export async function writeEvent(
  dbUrl: string,
  dbToken: string,
  event: EventData
): Promise<{ id: string }> {
  const id = `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  await dbContext.run({ url: dbUrl, token: dbToken }, async () => {
    await executeCreate({
      table: 'motion',
      id,
      type: event.type,
      scope: event.scope,
      data: event.data,
      created_by: event.created_by || 'system',
    });
  });

  // Run inbox rules (fire and forget)
  runInboxRules(dbUrl, dbToken, event).catch(err => {
    console.warn('[events] Inbox rule failed:', err);
  });

  return { id };
}

// ── Inbox Rule Engine ───────────────────────────────────────────────

interface InboxRule {
  eventType: string;
  condition?: (data: Record<string, any>) => boolean;
  assignee: string | ((data: Record<string, any>) => string);
  title: string | ((data: Record<string, any>) => string);
}

const INBOX_RULES: InboxRule[] = [
  // Kitchen ticket fired → task for kitchen staff
  {
    eventType: 'kitchen_ticket',
    assignee: 'kitchen',
    title: (d) => `Prepare order #${d.orderId || 'unknown'}`,
  },
  // Low stock adjustment → task for manager
  {
    eventType: 'stock_adjustment',
    condition: (d) => d.qty < 0 && (d.reason === 'sale' || d.reason === 'low_stock'),
    assignee: 'manager',
    title: (d) => `Restock ${d.product || 'item'}`,
  },
  // Booking confirmed → task for assigned staff
  {
    eventType: 'booking',
    assignee: (d) => d.staff_id || 'staff',
    title: (d) => `Confirm ${d.time || 'slot'} booking`,
  },
  // New order → task for waiter
  {
    eventType: 'motion',
    condition: (d) => d.status === 'pending',
    assignee: 'waiter',
    title: (d) => `Serve order #${d.orderId || 'unknown'}`,
  },
  // Low rating feedback → task for owner
  {
    eventType: 'feedback',
    condition: (d) => d.rating && d.rating < 3,
    assignee: 'owner',
    title: () => 'Review customer complaint',
  },
];

async function runInboxRules(
  dbUrl: string,
  dbToken: string,
  event: EventData
): Promise<void> {
  for (const rule of INBOX_RULES) {
    if (rule.eventType !== event.type) continue;

    // Check condition if specified
    if (rule.condition && !rule.condition(event.data)) continue;

    const assignee = typeof rule.assignee === 'function'
      ? rule.assignee(event.data)
      : rule.assignee;

    const title = typeof rule.title === 'function'
      ? rule.title(event.data)
      : rule.title;

    const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      await dbContext.run({ url: dbUrl, token: dbToken }, async () => {
        await executeCreate({
          table: 'tasks',
          id: taskId,
          type: 'inbox_task',
          scope: event.scope,
          title,
          data: {
            assigned_to: assignee,
            event_type: event.type,
            event_data: event.data,
            status: 'pending',
          },
        });
      });
    } catch (err) {
      console.warn(`[events] Failed to create inbox task for rule ${rule.eventType}:`, err);
    }
  }
}

// ── Get user inbox (pending tasks) ──────────────────────────────────

export async function getUserInbox(
  dbUrl: string,
  dbToken: string,
  userId: string,
  limit: number = 50
): Promise<any[]> {
  const result = await dbContext.run({ url: dbUrl, token: dbToken }, async () => {
    return executeRead({
      table: 'tasks',
      scope: 'all',
      filter: { assigned_to: userId, status: 'pending' },
      limit,
    });
  });

  return (result as any)?.rows || [];
}

// ── Mark task done ──────────────────────────────────────────────────

export async function markTaskDone(
  dbUrl: string,
  dbToken: string,
  taskId: string
): Promise<void> {
  await dbContext.run({ url: dbUrl, token: dbToken }, async () => {
    const { executeUpdate } = await import('./helpers');
    await executeUpdate({
      table: 'tasks',
      id: taskId,
      patch: {
        status: 'done',
        completed_at: new Date().toISOString(),
      },
    });
  });
}
