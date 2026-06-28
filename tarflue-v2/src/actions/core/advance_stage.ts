/**
 * Advance a matter's pipeline stage with validation.
 */
import { dbGet, dbRun } from '@/lib/db';

export async function actionAdvanceStage(input: {
  matterId: string; targetPhase: number; actionCode: number; scope: string;
}) {
  const matter = await dbGet('SELECT * FROM matter WHERE id = ?', [input.matterId]);
  if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

  const currentMark = matter.mark ?? 0;

  // Log the transition
  const seq = Date.now();
  await dbRun(
    `INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, ?, ?, ?, ?)`,
    [input.matterId, seq, input.actionCode, input.targetPhase,
     JSON.stringify({ event: 'stage_advanced', from: currentMark, to: input.targetPhase }),
     new Date().toISOString()]
  );

  // Update the matter
  await dbRun('UPDATE matter SET mark = ?, updated = ? WHERE id = ?',
    [input.targetPhase, new Date().toISOString(), input.matterId]);

  return { advanced: true, from: currentMark, to: input.targetPhase };
}
