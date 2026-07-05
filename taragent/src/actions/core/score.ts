import { dbGet, dbRun } from '@/lib/db';

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

export async function actionScore(input: {
  matterId: string;
  scope: string;
  criteria?: string;
}) {
  const matter = await dbGet('SELECT * FROM matter WHERE id = ?', [input.matterId]);
  if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

  const score = 50;
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO attr (matter, key, val, num, ref, time) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(matter, key) DO UPDATE SET val=excluded.val, num=excluded.num, ref=excluded.ref, time=excluded.time`,
    [input.matterId, 'score', null, score, null, now],
  );

  await dbRun(
    'INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta) VALUES (?, ?, ?, ?, ?, ?)',
    [
      input.matterId,
      0,
      input.matterId,
      `${matter.title} scored ${score}/100 based on ${input.criteria || 'overall quality and priority'}`,
      '',
      JSON.stringify({ table: 'matter', scope: input.scope, type: matter.type, score }),
    ],
  );

  return { matterId: input.matterId, score };
}
