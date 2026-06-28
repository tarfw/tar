import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { appendMotion, updateMatter } from '@/lib/helpers';

export const actionLogEvent = defineAction({
  name: 'action_log_event',
  description: 'Log an event to the motion table and optionally update the matter state.',
  input: v.object({
    matterId: v.string(),
    actionCode: v.number(),
    scope: v.string(),
    phase: v.optional(v.number()),
    data: v.optional(v.record(v.string(), v.any())),
    updateMark: v.optional(v.number()),
  }),
  output: v.object({ logged: v.boolean(), seq: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Logging event ${input.actionCode} for ${input.matterId}`);

    const motionResult = await appendMotion({
      stream: input.matterId,
      action: input.actionCode,
      phase: input.phase,
      data: input.data,
      scope: input.scope,
    });

    if (input.updateMark !== undefined) {
      await updateMatter({
        table: 'matter',
        id: input.matterId,
        scope: input.scope,
        patch: { mark: input.updateMark },
        reason: `Event ${input.actionCode}`,
      });
    }

    return { logged: true, seq: motionResult.seq };
  },
});
