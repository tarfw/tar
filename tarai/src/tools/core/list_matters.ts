import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { read } from '@/lib/tools';

export const toolListMatters = defineTool({
  name: 'tool_list_matters',
  description: 'Read filtered list of entities from form or matter table with optional filters, joins, and pagination.',
  input: v.object({
    table: v.picklist(['form', 'matter']),
    scope: v.string(),
    type: v.optional(v.string()),
    form: v.optional(v.string()),
    active: v.optional(v.boolean()),
    filters: v.optional(v.array(v.object({ key: v.string(), val: v.any() }))),
    order: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  }),
  output: v.object({ rows: v.array(v.record(v.string(), v.any())), count: v.number() }),
  async run({ input }) {
    return read(input);
  },
});
