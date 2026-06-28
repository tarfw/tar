import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolLinkGraph } from '@/tools/core/link_graph';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionNotify } from '@/actions/core/notify';

export const actionAssignTask = defineAction({
  name: 'action_assign_task',
  description: 'Assign a task to a team member and notify them.',
  input: v.object({
    taskId: v.string(),
    assigneeId: v.string(),
    assignedBy: v.string(),
    scope: v.string(),
  }),
  output: v.object({ assigned: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Assigning task ${input.taskId} to ${input.assigneeId}`);

    await harness.tools.call(toolSetAttr, {
      matterId: input.taskId, key: 'assignee', val: input.assigneeId, ref: input.assigneeId, scope: input.scope,
    });

    await harness.tools.call(toolLinkGraph, {
      src: input.assigneeId, rel: 'assigned_to', tgt: input.taskId, scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: input.taskId, action: 99993,
      data: { event: 'task_assigned', to: input.assigneeId, by: input.assignedBy },
      scope: input.scope,
    });

    await harness.actions.call(actionNotify, {
      to: input.assigneeId, channel: 'slack', template: 'task-assigned',
      data: { taskId: input.taskId, assignedBy: input.assignedBy }, scope: input.scope,
    });

    return { assigned: true };
  },
});
