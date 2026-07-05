import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

/**
 * Create a new task with assignee and project link.
 * @param input - Task details
 * @param input.title - Task title (required, non-empty)
 * @param input.description - Description (optional)
 * @param input.assigneeId - Assignee person ID (optional)
 * @param input.projectId - Parent project ID (optional)
 * @param input.priority - Priority level: low, medium, high (optional)
 * @param input.due - Due date (optional)
 * @param input.scope - Tenant scope
 * @returns Task matter ID
 */
export async function actionCreateTask(input: {
  title: string;
  description?: string;
  assigneeId?: string;
  projectId?: string;
  priority?: 'low' | 'medium' | 'high';
  due?: string;
  scope: string;
}): Promise<{ taskId: string }> {
  const taskId = `task_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'task', form: 'form-task',
    title: input.title, end: input.due,
    data: { description: input.description, priority: input.priority, due: input.due },
  });

  await setAttr({ matterId: taskId, key: 'status', val: 'todo', scope: input.scope });
  await setAttr({ matterId: taskId, key: 'priority', val: input.priority || 'medium', scope: input.scope });

  if (input.assigneeId) {
    await setAttr({ matterId: taskId, key: 'assignee', val: input.assigneeId, ref: input.assigneeId, scope: input.scope });
    await linkGraph({ src: input.assigneeId, rel: 'assigned_to', tgt: taskId, scope: input.scope });
  }

  if (input.projectId) {
    await linkGraph({ src: input.projectId, rel: 'contains', tgt: taskId, scope: input.scope });
  }

  await appendMotion({
    stream: taskId, action: 99993,
    data: { event: 'task_created', title: input.title, assignee: input.assigneeId },
    scope: input.scope,
  });

  return { taskId };
}
