import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { link } from '@/lib/tools';

export const toolLinkGraph = defineTool({
  name: 'tool_link_graph',
  description: 'Create a relationship edge between two entities in the graph table.',
  input: v.object({
    src: v.string(),
    rel: v.string(),
    tgt: v.string(),
    weight: v.optional(v.number()),
    bidirectional: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
    scope: v.string(),
  }),
  output: v.object({ src: v.string(), rel: v.string(), tgt: v.string(), status: v.string() }),
  async run({ input }) {
    return link(input);
  },
});
