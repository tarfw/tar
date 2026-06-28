import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';

export const actionResolveTicket = defineAction({
  name: 'action_resolve_ticket',
  description: 'Mark a support ticket as resolved.',
  input: v.object({
    ticketId: v.string(),
    resolution: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ resolved: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Resolving ticket ${input.ticketId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.ticketId, targetPhase: 6, actionCode: 99993, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, {
      matterId: input.ticketId, key: 'status', val: 'resolved', scope: input.scope,
    });

    return { resolved: true };
  },
});
