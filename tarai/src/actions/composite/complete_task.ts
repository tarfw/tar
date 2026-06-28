import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionCompleteTask = defineAction({
  name: 'action_complete_task',
  description: 'Mark a task as done and log the completion.',
  input: v.object({
    taskId: v.string(),
    completedBy: v.string(),
    scope: v.string(),
  }),
  output: v.object({ completed: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Completing task ${input.taskId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.taskId, targetPhase: 6, actionCode: 70004, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, {
      matterId: input.taskId, key: 'status', val: 'done', scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: input.taskId, action: 99993,
      data: { event: 'task_completed', by: input.completedBy },
      scope: input.scope,
    });

    return { completed: true };
  },
});
