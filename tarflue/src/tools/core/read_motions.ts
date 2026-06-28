import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { read } from '@/lib/tools';

export const toolReadMotions = defineTool({
  name: 'tool_read_motions',
  description: 'Read event history from the motion table for a given stream.',
  input: v.object({
    scope: v.string(),
    stream: v.string(),
    seq_from: v.optional(v.number()),
    seq_to: v.optional(v.number()),
    limit: v.optional(v.number()),
  }),
  output: v.object({ rows: v.array(v.record(v.string(), v.any())), count: v.number() }),
  async run({ input }) {
    return read({
      table: 'motion',
      scope: input.scope,
      stream: input.stream,
      seq_from: input.seq_from,
      seq_to: input.seq_to,
      limit: input.limit ?? 50,
    });
  },
});
