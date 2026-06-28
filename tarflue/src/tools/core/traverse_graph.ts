import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { read } from '@/lib/tools';

export const toolTraverseGraph = defineTool({
  name: 'tool_traverse_graph',
  description: 'Find relationships by traversing the graph table. Supports recursive CTE traversal up to depth 3.',
  input: v.object({
    scope: v.string(),
    src: v.optional(v.string()),
    rel: v.optional(v.string()),
    tgt: v.optional(v.string()),
    depth: v.optional(v.number()),
    limit: v.optional(v.number()),
  }),
  output: v.object({ rows: v.array(v.record(v.string(), v.any())), count: v.number() }),
  async run({ input }) {
    return read({
      table: 'graph',
      scope: input.scope,
      graph_filter: { src: input.src, rel: input.rel, tgt: input.tgt },
      depth: input.depth,
      limit: input.limit ?? 50,
    });
  },
});
