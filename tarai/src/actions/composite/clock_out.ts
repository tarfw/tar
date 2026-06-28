import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionClockOut = defineAction({
  name: 'action_clock_out',
  description: 'Record employee clock-out for attendance.',
  input: v.object({
    attendanceId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ clockedOut: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Clocking out attendance ${input.attendanceId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.attendanceId, targetPhase: 2, actionCode: 502, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, {
      matterId: input.attendanceId, key: 'status', val: 'out', scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: input.attendanceId, action: 99993,
      data: { event: 'clock_out', clockOut: new Date().toISOString() },
      scope: input.scope,
    });

    return { clockedOut: true };
  },
});
