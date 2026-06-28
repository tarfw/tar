import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

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
  async run({ input, log }) {
    log.info(`Creating project: ${input.title}`);

    const projectId = `project_${Date.now()}`;
    await createMatter({
      table: 'matter', scope: input.scope, type: 'project',
      title: input.title, start: input.start, end: input.end,
      data: { description: input.description },
    });

    await setAttr({ matterId: projectId, key: 'status', val: 'active', scope: input.scope });

    await appendMotion({
      stream: projectId, action: 99993,
      data: { event: 'project_created', title: input.title },
      scope: input.scope,
    });

    return { projectId };
  },
});
