import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import { toolListMatters } from '@/tools/core/list_matters';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionScore } from '@/actions/core/score';

const agent = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  tools: [toolListMatters, toolSetAttr, toolAppendMotion],
  actions: [actionScore],
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

    const backlogResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope: input.scope,
      type: 'task',
      filters: [{ key: 'status', val: 'todo' }],
    });

    const scoredTasks = [];
    let totalHours = 0;

    for (const task of backlogResult.rows) {
      const scoreResult = await harness.actions.call(actionScore, {
        matterId: task.id,
        scope: input.scope,
        criteria: 'complexity, dependencies, business value',
      });

      const estimate = task.data?.estimate || 4;
      scoredTasks.push({
        id: task.id,
        title: task.title,
        score: scoreResult.score,
        estimate,
      });
    }

    scoredTasks.sort((a: any, b: any) => b.score - a.score);

    const selectedTasks = [];
    for (const task of scoredTasks) {
      if (totalHours + task.estimate <= input.capacity) {
        selectedTasks.push(task);
        totalHours += task.estimate;

        await harness.tools.call(toolAppendMotion, {
          stream: input.sprintId,
          action: 99993,
          data: { event: 'task_added_to_sprint', taskId: task.id, estimate: task.estimate },
          scope: input.scope,
        });
      }
    }

    log.info(`Selected ${selectedTasks.length} tasks (${totalHours}h / ${input.capacity}h capacity)`);

    return {
      sprintId: input.sprintId,
      tasks: selectedTasks,
      totalHours,
      capacity: input.capacity,
    };
  },
});
