import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getPreparedDbForScope } from '@/lib/db';

export const toolSetAttr = defineTool({
  name: 'tool_set_attr',
  description: 'Set a hot field on a matter. Uses UNIQUE(matter, key) for upsert. Indexed for fast lookups.',
  input: v.object({
    matterId: v.string(),
    key: v.string(),
    val: v.optional(v.string()),
    num: v.optional(v.number()),
    ref: v.optional(v.string()),
    scope: v.optional(v.string()),
  }),
  output: v.object({ matter: v.string(), key: v.string(), status: v.string() }),
  async run({ input }) {
    const db = await getPreparedDbForScope(input.scope || null);
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO attr (matter, key, val, num, ref, time)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(matter, key) DO UPDATE SET
         val = excluded.val,
         num = excluded.num,
         ref = excluded.ref,
         time = excluded.time`,
      [input.matterId, input.key, input.val ?? null, input.num ?? null, input.ref ?? null, now]
    );

    return { matter: input.matterId, key: input.key, status: 'set' };
  },
});
