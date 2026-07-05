import { dbGet, dbAll, dbRun } from '@/lib/db';

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

export async function actionRunPipeline(input: {
  matterId: string;
  pipelineId: string;
  targetPhase: number;
  actionCode: number;
  scope: string;
  data?: Record<string, any>;
}) {
  const pipelineRow = await dbGet(
    'SELECT * FROM form WHERE id = ? AND scope = ?',
    [input.pipelineId, input.scope],
  );
  if (!pipelineRow) throw new Error(`Pipeline not found: ${input.pipelineId}`);

  const pipelineData = parseJson(pipelineRow.data);
  const stages = pipelineData.stages || [];
  const transitions = pipelineData.transitions || {};

  const matter = await dbGet('SELECT * FROM matter WHERE id = ?', [input.matterId]);
  if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

  const currentMark = matter.mark ?? 0;
  const targetStage = stages.find((s: any) => s.phase === input.targetPhase);
  if (!targetStage) throw new Error(`Invalid target phase: ${input.targetPhase}`);

  const transitionKey = `${currentMark}→${input.targetPhase}`;
  const anyKey = `any→${input.targetPhase}`;
  if (transitions[transitionKey] === undefined && transitions[anyKey] === undefined) {
    throw new Error(`Invalid transition: ${currentMark} → ${input.targetPhase}`);
  }

  const nextSeqRes = await dbGet(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
    [input.matterId],
  );
  const seq = Number(nextSeqRes?.next ?? 1);
  const now = new Date().toISOString();

  await dbRun(
    'INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [input.matterId, seq, input.actionCode, input.targetPhase, null, null, JSON.stringify({ event: 'pipeline_advanced', pipeline: input.pipelineId, from: currentMark, to: input.targetPhase }), now],
  );

  const updatedAt = new Date().toISOString();
  const sets = ['updated = ?'];
  const args: any[] = [updatedAt];

  if (input.data !== undefined) {
    sets.push('data = ?');
    args.push(JSON.stringify(input.data));
  }
  sets.push('mark = ?');
  args.push(input.targetPhase);

  args.push(input.matterId);
  await dbRun(`UPDATE matter SET ${sets.join(', ')} WHERE id = ?`, args);

  await dbRun(
    'INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 1001, ?, ?, ?)',
    [input.matterId, seq + 1, input.targetPhase, JSON.stringify({ reason: `Pipeline ${input.pipelineId}: ${currentMark} → ${input.targetPhase}`, changed: ['mark', 'data'] }), updatedAt],
  );

  return { completed: true, phase: input.targetPhase };
}
