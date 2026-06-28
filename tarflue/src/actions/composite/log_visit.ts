import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, appendMotion } from '@/lib/helpers';

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
  async run({ input, log }) {
    log.info(`Logging visit: ${input.person}`);

    const visitId = `visit_${Date.now()}`;
    await createMatter({
      table: 'matter',
      scope: input.scope,
      type: 'visit',
      title: `Visit: ${input.person}`,
      data: { notes: input.notes, rating: input.rating },
    });

    await appendMotion({
      stream: visitId, action: 99993,
      data: { event: 'visit_logged', person: input.person, rating: input.rating },
      scope: input.scope,
    });

    return { visitId };
  },
});
