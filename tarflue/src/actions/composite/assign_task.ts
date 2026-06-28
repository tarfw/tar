import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { setAttr, linkGraph, appendMotion, readForm } from '@/lib/helpers';

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
  async run({ input, log }) {
    log.info(`Assigning task ${input.taskId} to ${input.assigneeId}`);

    await setAttr({
      matterId: input.taskId, key: 'assignee', val: input.assigneeId, ref: input.assigneeId, scope: input.scope,
    });

    await linkGraph({
      src: input.assigneeId, rel: 'assigned_to', tgt: input.taskId, scope: input.scope,
    });

    await appendMotion({
      stream: input.taskId, action: 99993,
      data: { event: 'task_assigned', to: input.assigneeId, by: input.assignedBy },
      scope: input.scope,
    });

    const channelResult = await readForm({ scope: input.scope, type: 'channel' });
    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === 'slack' || r.data?.provider === 'slack'
    );
    if (channelConfig) {
      log.info(`Found channel config for slack, would send via provider`);
    }
    await appendMotion({
      stream: input.assigneeId, action: 99993,
      data: { event: 'notification', channel: 'slack', template: 'task-assigned', taskId: input.taskId, assignedBy: input.assignedBy },
      scope: input.scope,
    });

    return { assigned: true };
  },
});
