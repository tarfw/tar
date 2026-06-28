import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { read } from '@/lib/tools';

export const toolGetMatter = defineTool({
  name: 'tool_get_matter',
  description: 'Read a single entity by ID from form or matter table.',
  input: v.object({
    table: v.picklist(['form', 'matter']),
    scope: v.string(),
    id: v.string(),
  }),
  output: v.object({ rows: v.array(v.record(v.string(), v.any())), count: v.number() }),
  async run({ input }) {
    return read({ ...input, limit: 1 });
  },
});
