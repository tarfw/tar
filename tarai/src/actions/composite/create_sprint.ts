import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionCreateSprint = defineAction({
  name: 'action_create_sprint',
  description: 'Create a new sprint with capacity and date range.',
  input: v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    projectId: v.string(),
    start: v.string(),
    end: v.string(),
    capacity: v.optional(v.number()),
    scope: v.string(),
  }),
  output: v.object({ sprintId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Creating sprint: ${input.title}`);

    const sprintId = `sprint_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'sprint',
      title: input.title, start: input.start, end: input.end,
      data: { project: input.projectId, capacity: input.capacity },
    });

    await harness.tools.call(toolSetAttr, { matterId: sprintId, key: 'status', val: 'planning', scope: input.scope });
    if (input.capacity) {
      await harness.tools.call(toolSetAttr, { matterId: sprintId, key: 'capacity', num: input.capacity, scope: input.scope });
    }

    await harness.tools.call(toolAppendMotion, {
      stream: sprintId, action: 99993,
      data: { event: 'sprint_created', title: input.title, project: input.projectId },
      scope: input.scope,
    });

    return { sprintId };
  },
});
