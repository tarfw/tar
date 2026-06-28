import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolGetMatter } from '@/tools/core/get_matter';
import { toolStoreMemory } from '@/tools/core/store_memory';

export const actionEmbed = defineAction({
  name: 'action_embed',
  description: 'Chunk text, generate embedding, and store in memory table for semantic search.',
  input: v.object({
    matterId: v.string(),
    scope: v.string(),
    text: v.string(),
  }),
  output: v.object({ embedded: v.boolean(), chunks: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Embedding text for matter ${input.matterId}`);

    const matterResult = await harness.tools.call(toolGetMatter, {
      table: 'matter',
      scope: input.scope,
      id: input.matterId,
    });

    const matter = matterResult.rows[0];
    const matterType = matter?.type || 'unknown';

    const chunkSize = 500;
    const overlap = 50;
    const chunks: string[] = [];
    let start = 0;

    while (start < input.text.length) {
      const end = Math.min(start + chunkSize, input.text.length);
      chunks.push(input.text.slice(start, end));
      start += chunkSize - overlap;
    }

    for (let i = 0; i < chunks.length; i++) {
      await harness.tools.call(toolStoreMemory, {
        id: `${input.matterId}_chunk`,
        chunk: i,
        matter: input.matterId,
        text: chunks[i],
        embedding: '',
        meta: {
          table: 'matter',
          scope: input.scope,
          type: matterType,
          title: matter?.title || '',
          chunkIndex: i,
          totalChunks: chunks.length,
        },
        scope: input.scope,
      });
    }

    return { embedded: true, chunks: chunks.length };
  },
});
