import { dbGet, dbAll, dbRun } from '@/lib/db';

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

export async function actionNotify(input: {
  to: string;
  channel: string;
  template?: string;
  data?: Record<string, any>;
  scope: string;
}) {
  const channelRows = await dbAll(
    'SELECT * FROM form WHERE scope = ? AND type = ? ORDER BY time DESC LIMIT ?',
    [input.scope, 'channel', 50],
  );

  const channelConfig = channelRows.find(
    (r: any) => r.id === input.channel || parseJson(r.data)?.provider === input.channel,
  );

  if (channelConfig) {
    console.log(`Found channel config for ${input.channel}, would send via provider`);
  }

  const nextSeqRes = await dbGet(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
    [input.to],
  );
  const seq = Number(nextSeqRes?.next ?? 1);
  const now = new Date().toISOString();

  await dbRun(
    'INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [input.to, seq, 99993, null, null, null, JSON.stringify({ event: 'notification', channel: input.channel, template: input.template, ...(input.data || {}) }), now],
  );

  return { sent: true, channel: input.channel };
}
