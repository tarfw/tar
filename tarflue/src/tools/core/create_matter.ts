import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { create } from '@/lib/tools';

const inputSchema = v.object({
  table: v.picklist(['form', 'matter']),
  scope: v.string(),
  type: v.string(),
  form: v.optional(v.string()),
  title: v.optional(v.string()),
  value: v.optional(v.number()),
  qty: v.optional(v.number()),
  start: v.optional(v.string()),
  end: v.optional(v.string()),
  mark: v.optional(v.number()),
  data: v.optional(v.record(v.string(), v.any())),
  owner: v.optional(v.string()),
  embed: v.optional(v.boolean()),
});

export const toolCreateMatter = defineTool({
  name: 'tool_create_matter',
  description: 'Create a form or matter record with optional links, motion log, and vector index.',
  input: inputSchema,
  output: v.object({ id: v.string(), time: v.string(), status: v.string() }),
  async run({ input }) {
    return create(input);
  },
});
