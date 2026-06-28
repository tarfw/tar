import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolLinkGraph } from '@/tools/core/link_graph';
import { toolAppendMotion } from '@/tools/core/append_motion';

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
  async run({ harness, input, log }) {
    log.info(`Creating task: ${input.title}`);

    const taskId = `task_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'task', form: 'form-task',
      title: input.title, end: input.due,
      data: { description: input.description, priority: input.priority, due: input.due },
    });

    await harness.tools.call(toolSetAttr, { matterId: taskId, key: 'status', val: 'todo', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: taskId, key: 'priority', val: input.priority || 'medium', scope: input.scope });

    if (input.assigneeId) {
      await harness.tools.call(toolSetAttr, { matterId: taskId, key: 'assignee', val: input.assigneeId, ref: input.assigneeId, scope: input.scope });
      await harness.tools.call(toolLinkGraph, { src: input.assigneeId, rel: 'assigned_to', tgt: taskId, scope: input.scope });
    }

    if (input.projectId) {
      await harness.tools.call(toolLinkGraph, { src: input.projectId, rel: 'contains', tgt: taskId, scope: input.scope });
    }

    await harness.tools.call(toolAppendMotion, {
      stream: taskId, action: 99993,
      data: { event: 'task_created', title: input.title, assignee: input.assigneeId },
      scope: input.scope,
    });

    return { taskId };
  },
});
