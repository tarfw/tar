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
    scope: v.optional(v.string()),
  }),

  async run({ harness, input, log }) {
    log.info('Generating daily report');

    const scope = input.scope || 'system';
    const today = new Date().toISOString().split('T')[0];

    const orders = await listMatters({ table: 'matter', scope, type: 'order' });
    const tickets = await listMatters({ table: 'matter', scope, type: 'ticket' });
    const tasks = await listMatters({ table: 'matter', scope, type: 'task' });

    const completedTasks = tasks.rows.filter((t: any) => t.mark === 6).length;
    const openTickets = tickets.rows.filter((t: any) => t.data?.status === 'open').length;

    const report = {
      date: today,
      orders: orders.count,
      tickets: { total: tickets.count, open: openTickets },
      tasks: { total: tasks.count, completed: completedTasks },
    };

    log.info(`Daily report: ${JSON.stringify(report)}`);
    return report;
  },
});
