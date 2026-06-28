import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getPreparedDbForScope } from '@/lib/db';

export const toolAppendMotion = defineTool({
  name: 'tool_append_motion',
  description: 'Log one event to the motion table (append-only audit trail).',
  input: v.object({
    stream: v.string(),
    action: v.number(),
    phase: v.optional(v.number()),
    delta: v.optional(v.number()),
    client_ref: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.any())),
    scope: v.optional(v.string()),
  }),
  output: v.object({ stream: v.string(), seq: v.number() }),
  async run({ input }) {
    const db = await getPreparedDbForScope(input.scope || null);
    const nextSeqRes = await db.get(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM motion WHERE stream = ?',
      [input.stream]
    );
    const seq = Number(nextSeqRes?.next ?? 1);
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO motion (stream, seq, action, phase, delta, client_ref, data, time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.stream,
        seq,
        input.action,
        input.phase ?? null,
        input.delta ?? null,
        input.client_ref || null,
        JSON.stringify(input.data || {}),
        now,
      ]
    );

    return { stream: input.stream, seq };
  },
});
