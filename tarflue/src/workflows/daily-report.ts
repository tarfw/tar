import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import { toolListMatters } from '@/tools/core/list_matters';
import { actionNotify } from '@/actions/core/notify';

const agent = defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  tools: [toolListMatters],
  actions: [actionNotify],
}));

export default defineWorkflow({
  agent,
  input: v.object({
    scope: v.optional(v.string()),
  }),

  async run({ harness, input, log }) {
    log.info('Generating daily report');

    const scope = input.scope || 'system';
    const today = new Date().toISOString().split('T')[0];

    const ordersResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope,
      type: 'order',
    });

    const ticketsResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope,
      type: 'ticket',
    });

    const tasksResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope,
      type: 'task',
    });

    const completedTasks = tasksResult.rows.filter(
      (t: any) => t.mark === 6
    ).length;

    const openTickets = ticketsResult.rows.filter(
      (t: any) => t.data?.status === 'open'
    ).length;

    const report = {
      date: today,
      orders: ordersResult.count,
      tickets: { total: ticketsResult.count, open: openTickets },
      tasks: { total: tasksResult.count, completed: completedTasks },
    };

    await harness.actions.call(actionNotify, {
      to: 'owner',
      channel: 'email',
      template: 'daily-report',
      data: report,
      scope,
    });

    log.info(`Daily report generated: ${JSON.stringify(report)}`);

    return report;
  },
});
