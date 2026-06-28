import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

export const actionCreateTask = defineAction({
  name: 'action_create_task',
  description: 'Create a new task with assignee and project link.',
  input: v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    priority: v.optional(v.picklist(['low', 'medium', 'high'])),
    due: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ taskId: v.string() }),
  async run({ input, log }) {
    log.info(`Creating task: ${input.title}`);

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
  },
});
