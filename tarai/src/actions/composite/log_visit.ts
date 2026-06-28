import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionLogVisit = defineAction({
  name: 'action_log_visit',
  description: 'Record a customer visit to the store.',
  input: v.object({
    person: v.pipe(v.string(), v.minLength(1)),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),
    scope: v.string(),
  }),
  output: v.object({ visitId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Logging visit: ${input.person}`);

    const visitId = `visit_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter',
      scope: input.scope,
      type: 'visit',
      title: `Visit: ${input.person}`,
      data: { notes: input.notes, rating: input.rating },
    });

    await harness.tools.call(toolAppendMotion, {
      stream: visitId, action: 99993,
      data: { event: 'visit_logged', person: input.person, rating: input.rating },
      scope: input.scope,
    });

    return { visitId };
  },
});
