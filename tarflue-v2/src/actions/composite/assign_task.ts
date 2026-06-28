import { setAttr, linkGraph, appendMotion, readForm } from '@/lib/helpers';

/**
 * Assign a task to a team member and notify them.
 * @param input - Assignment details
 * @param input.taskId - Task matter ID
 * @param input.assigneeId - Assignee person ID
 * @param input.assignedBy - Person making the assignment
 * @param input.scope - Tenant scope
 * @returns Whether task was assigned
 */
export async function actionAssignTask(input: {
  taskId: string;
  assigneeId: string;
  assignedBy: string;
  scope: string;
}): Promise<{ assigned: boolean }> {
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
    console.log(`Found channel config for slack, would send via provider`);
  }
  await appendMotion({
    stream: input.assigneeId, action: 99993,
    data: { event: 'notification', channel: 'slack', template: 'task-assigned', taskId: input.taskId, assignedBy: input.assignedBy },
    scope: input.scope,
  });

  return { assigned: true };
}
