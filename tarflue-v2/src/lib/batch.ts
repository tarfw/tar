/**
 * Batch SQLite writes + lazy timeline flush.
 * Groups multiple writes in transactions, buffers motion events.
 */

import { dbRun, dbAll } from './db';

interface PendingWrite {
  sql: string;
  args: any[];
}

interface PendingMotion {
  stream: string;
  action: number;
  data: Record<string, any>;
  scope?: string;
}

// Buffer for pending writes per DO
const writeBuffers = new Map<string, PendingWrite[]>();
const motionBuffers = new Map<string, PendingMotion[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

const FLUSH_INTERVAL_MS = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 50;

/**
 * Add a write to the batch buffer
 */
export function batchWrite(
  doId: string,
  sql: string,
  args: any[] = []
): void {
  if (!writeBuffers.has(doId)) {
    writeBuffers.set(doId, []);
  }
  writeBuffers.get(doId)!.push({ sql, args });

  // Auto-flush if buffer is full
  if (writeBuffers.get(doId)!.length >= MAX_BUFFER_SIZE) {
    flushWrites(doId);
  } else {
    scheduleFlush(doId);
  }
}

/**
 * Add a motion event to the lazy flush buffer
 */
export function bufferMotion(
  doId: string,
  motion: PendingMotion
): void {
  if (!motionBuffers.has(doId)) {
    motionBuffers.set(doId, []);
  }
  motionBuffers.get(doId)!.push(motion);

  // Auto-flush if buffer is full
  if (motionBuffers.get(doId)!.length >= MAX_BUFFER_SIZE) {
    flushMotions(doId);
  } else {
    scheduleFlush(doId);
  }
}

/**
 * Schedule a flush after FLUSH_INTERVAL_MS
 */
function scheduleFlush(doId: string): void {
  if (flushTimers.has(doId)) return;
  flushTimers.set(doId, setTimeout(() => {
    flushWrites(doId);
    flushMotions(doId);
    flushTimers.delete(doId);
  }, FLUSH_INTERVAL_MS));
}

/**
 * Flush all pending writes for a DO in a single transaction
 */
export async function flushWrites(doId: string): Promise<number> {
  const writes = writeBuffers.get(doId);
  if (!writes || writes.length === 0) return 0;

  writeBuffers.delete(doId);

  await dbRun('BEGIN TRANSACTION');
  try {
    for (const write of writes) {
      await dbRun(write.sql, write.args);
    }
    await dbRun('COMMIT');
    return writes.length;
  } catch (e) {
    await dbRun('ROLLBACK').catch(() => {});
    throw e;
  }
}

/**
 * Flush all pending motion events to user's Turso DB
 */
export async function flushMotions(doId: string): Promise<number> {
  const motions = motionBuffers.get(doId);
  if (!motions || motions.length === 0) return 0;

  motionBuffers.delete(doId);

  let count = 0;
  for (const motion of motions) {
    try {
      const nextSeqRes = await dbAll(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
        [motion.stream]
      );
      const seq = Number(nextSeqRes[0]?.next ?? 1);

      await dbRun(
        'INSERT INTO motion (stream, seq, action, data, time) VALUES (?, ?, ?, ?, ?)',
        [motion.stream, seq, motion.action, JSON.stringify(motion.data), new Date().toISOString()]
      );
      count++;
    } catch (e) {
      console.error('[Batch] Motion flush error:', e);
    }
  }

  return count;
}

/**
 * Force flush all buffers for a DO (called on DO shutdown)
 */
export async function forceFlush(doId: string): Promise<{ writes: number; motions: number }> {
  const writes = await flushWrites(doId);
  const motions = await flushMotions(doId);
  return { writes, motions };
}

/**
 * Get buffer stats for monitoring
 */
export function getBufferStats(): { doCount: number; totalWrites: number; totalMotions: number } {
  let totalWrites = 0;
  let totalMotions = 0;
  for (const writes of writeBuffers.values()) {
    totalWrites += writes.length;
  }
  for (const motions of motionBuffers.values()) {
    totalMotions += motions.length;
  }
  return {
    doCount: writeBuffers.size + motionBuffers.size,
    totalWrites,
    totalMotions,
  };
}
