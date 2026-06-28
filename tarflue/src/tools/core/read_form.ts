import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { read } from '@/lib/tools';

export const toolReadForm = defineTool({
  name: 'tool_read_form',
  description: 'Read configuration from the form table (pipelines, actions, skills, agents, workflows, schedules, channels).',
  input: v.object({
    scope: v.string(),
    id: v.optional(v.string()),
    type: v.optional(v.string()),
    active: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  }),
  output: v.object({ rows: v.array(v.record(v.string(), v.any())), count: v.number() }),
  async run({ input }) {
    return read({
      table: 'form',
      scope: input.scope,
      id: input.id,
      type: input.type,
      active: input.active,
      limit: input.limit ?? 50,
    });
  },
});
