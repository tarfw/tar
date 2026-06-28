import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { update } from '@/lib/tools';

export const toolUpdateMatter = defineTool({
  name: 'tool_update_matter',
  description: 'Update a form or matter record. Validates state machine phase transitions and deep-merges data.',
  input: v.object({
    table: v.picklist(['form', 'matter']),
    id: v.string(),
    scope: v.string(),
    patch: v.object({
      qty: v.optional(v.number()),
      value: v.optional(v.number()),
      active: v.optional(v.boolean()),
      mark: v.optional(v.number()),
      variant: v.optional(v.number()),
      geo: v.optional(v.string()),
      start: v.optional(v.string()),
      end: v.optional(v.string()),
      data: v.optional(v.record(v.string(), v.any())),
      title: v.optional(v.string()),
      public: v.optional(v.boolean()),
    }),
    phase: v.optional(v.number()),
    opcode: v.optional(v.number()),
    delta: v.optional(v.number()),
    reason: v.optional(v.string()),
  }),
  output: v.object({ success: v.boolean(), id: v.optional(v.string()), time: v.optional(v.string()) }),
  async run({ input }) {
    return update(input);
  },
});
