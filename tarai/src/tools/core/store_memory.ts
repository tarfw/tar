import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getPreparedDbForScope } from '@/lib/db';

export const toolStoreMemory = defineTool({
  name: 'tool_store_memory',
  description: 'Store a text chunk with its vector embedding in the memory table for semantic search.',
  input: v.object({
    id: v.string(),
    chunk: v.optional(v.number()),
    matter: v.optional(v.string()),
    text: v.string(),
    embedding: v.string(),
    meta: v.optional(v.record(v.string(), v.any())),
    scope: v.optional(v.string()),
  }),
  output: v.object({ id: v.string(), chunk: v.number(), status: v.string() }),
  async run({ input }) {
    const db = await getPreparedDbForScope(input.scope || null);
    const chunk = input.chunk ?? 0;

    await db.run(
      `INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta)
       VALUES (?, ?, ?, ?, vector32(?), ?)`,
      [
        input.id,
        chunk,
        input.matter ?? null,
        input.text,
        input.embedding,
        JSON.stringify(input.meta || {}),
      ]
    );

    return { id: input.id, chunk, status: 'stored' };
  },
});
