import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { listMatters } from '@/lib/helpers';

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({
  model: 'groq/openai/gpt-oss-120b',
}));

export default defineWorkflow({
  agent,
  input: v.object({
    scope: v.string(),
  }),

  async run({ harness, input, log }) {
    log.info('Running daily standup reminder');

    const tasks = await listMatters({ table: 'matter', scope: input.scope, type: 'task' });
    const blocked = await listMatters({ table: 'matter', scope: input.scope, type: 'task' });

    const inProgress = tasks.rows.filter((t: any) => t.data?.status === 'in_progress');
    const blockedTasks = blocked.rows.filter((t: any) => t.data?.status === 'blocked');

    log.info(`Standup: ${inProgress.length} in progress, ${blockedTasks.length} blocked`);
    return { inProgress: inProgress.length, blocked: blockedTasks.length };
  },
});
