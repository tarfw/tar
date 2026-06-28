import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { search } from '@/lib/tools';

export const toolSearchMemory = defineTool({
  name: 'tool_search_memory',
  description: 'Semantic search across entities using vector embeddings, full-text search, or structured queries.',
  input: v.object({
    query: v.string(),
    scope: v.optional(v.string()),
    type: v.optional(v.string()),
    table: v.optional(v.picklist(['form', 'matter'])),
    mode: v.optional(v.picklist(['hybrid', 'vector', 'fts', 'structured', 'geo'])),
    limit: v.optional(v.number()),
    threshold: v.optional(v.number()),
  }),
  output: v.array(v.object({
    id: v.string(),
    text: v.string(),
    meta: v.record(v.string(), v.any()),
    similarity: v.number(),
    source: v.string(),
  })),
  async run({ input }) {
    return search(input);
  },
});
