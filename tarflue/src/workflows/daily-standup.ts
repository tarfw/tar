import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import { toolListMatters } from '@/tools/core/list_matters';
import { toolReadMotions } from '@/tools/core/read_motions';
import { actionNotify } from '@/actions/core/notify';

const agent = defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  tools: [toolListMatters, toolReadMotions],
  actions: [actionNotify],
}));

export default defineWorkflow({
  agent,
  input: v.object({
    scope: v.string(),
  }),

  async run({ harness, input, log }) {
    log.info('Running daily standup reminder');

    const tasksResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope: input.scope,
      type: 'task',
      filters: [{ key: 'status', val: 'in_progress' }],
    });

    const blockedResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope: input.scope,
      type: 'task',
      filters: [{ key: 'status', val: 'blocked' }],
    });

    const standupData = {
      inProgress: tasksResult.rows.map((t: any) => ({
        title: t.title,
        assignee: t.data?.assignee || 'unassigned',
      })),
      blocked: blockedResult.rows.map((t: any) => ({
        title: t.title,
        reason: t.data?.blockReason || 'unknown',
      })),
    };

    await harness.actions.call(actionNotify, {
      to: 'team',
      channel: 'slack',
      template: 'standup-reminder',
      data: standupData,
      scope: input.scope,
    });

    log.info(`Standup reminder sent: ${tasksResult.count} in progress, ${blockedResult.count} blocked`);

    return standupData;
  },
});
