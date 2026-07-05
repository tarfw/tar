import { dbGet, dbRun } from '@/lib/db';

export async function actionLogEvent(input: {
  matterId: string;
  actionCode: number;
  scope: string;
  phase?: number;
  data?: Record<string, any>;
  updateMark?: number;
}) {
  const nextSeqRes = await dbGet(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
    [input.matterId],
  );
  const seq = Number(nextSeqRes?.next ?? 1);
  const now = new Date().toISOString();

  await dbRun(
    'INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [input.matterId, seq, input.actionCode, input.phase ?? null, null, null, JSON.stringify(input.data || {}), now],
  );

  if (input.updateMark !== undefined) {
    const updatedAt = new Date().toISOString();
    await dbRun(
      'UPDATE matter SET mark = ?, updated = ? WHERE id = ?',
      [input.updateMark, updatedAt, input.matterId],
    );
    await dbRun(
      'INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 1001, ?, ?, ?)',
      [input.matterId, seq + 1, input.phase ?? null, JSON.stringify({ reason: `Event ${input.actionCode}`, changed: ['mark'] }), updatedAt],
    );
  }

  return { logged: true, seq };
}
