import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionCreateProject = defineAction({
  name: 'action_create_project',
  description: 'Create a new project with metadata.',
  input: v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.string()),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ projectId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Creating project: ${input.title}`);

    const projectId = `project_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'project',
      title: input.title, start: input.start, end: input.end,
      data: { description: input.description },
    });

    await harness.tools.call(toolSetAttr, { matterId: projectId, key: 'status', val: 'active', scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: projectId, action: 99993,
      data: { event: 'project_created', title: input.title },
      scope: input.scope,
    });

    return { projectId };
  },
});
