import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionClockIn = defineAction({
  name: 'action_clock_in',
  description: 'Record employee clock-in for attendance.',
  input: v.object({
    employeeId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ attendanceId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Clocking in employee ${input.employeeId}`);

    const attendanceId = `att_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'attendance',
      title: `Attendance ${input.employeeId}`,
      data: { employee: input.employeeId, clockIn: new Date().toISOString() },
    });

    await harness.tools.call(toolSetAttr, { matterId: attendanceId, key: 'status', val: 'in', scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: attendanceId, action: 99993,
      data: { event: 'clock_in', employee: input.employeeId },
      scope: input.scope,
    });

    return { attendanceId };
  },
});
