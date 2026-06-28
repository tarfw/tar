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
    sprintId: v.string(),
    scope: v.string(),
    capacity: v.number(),
  }),

  async run({ harness, input, log }) {
    log.info(`Planning sprint ${input.sprintId}`);

    const backlog = await listMatters({ table: 'matter', scope: input.scope, type: 'task' });
    const todoTasks = backlog.rows.filter((t: any) => t.data?.status === 'todo');

    let totalHours = 0;
    const selectedTasks = [];

    for (const task of todoTasks) {
      const estimate = task.data?.estimate || 4;
      if (totalHours + estimate <= input.capacity) {
        selectedTasks.push({ id: task.id, title: task.title, estimate });
        totalHours += estimate;
      }
    }

    log.info(`Selected ${selectedTasks.length} tasks (${totalHours}h / ${input.capacity}h capacity)`);
    return { sprintId: input.sprintId, tasks: selectedTasks, totalHours, capacity: input.capacity };
  },
});
