import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionEndShift = defineAction({
  name: 'action_end_shift',
  description: 'Close a cashier shift with ending cash and variance.',
  input: v.object({
    shiftId: v.string(),
    endingCash: v.number(),
    scope: v.string(),
  }),
  output: v.object({ closed: v.boolean(), variance: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Ending shift ${input.shiftId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.shiftId, targetPhase: 4, actionCode: 80022, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, { matterId: input.shiftId, key: 'status', val: 'closed', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: input.shiftId, key: 'ending_cash', num: input.endingCash, scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: input.shiftId, action: 99993,
      data: { event: 'shift_ended', endingCash: input.endingCash },
      scope: input.scope,
    });

    return { closed: true, variance: 0 };
  },
});
