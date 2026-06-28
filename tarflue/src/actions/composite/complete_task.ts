import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

export const actionCompleteTask = defineAction({
  name: 'action_complete_task',
  description: 'Mark a task as done and log the completion.',
  input: v.object({
    taskId: v.string(),
    completedBy: v.string(),
    scope: v.string(),
  }),
  output: v.object({ completed: v.boolean() }),
  async run({ input, log }) {
    log.info(`Completing task ${input.taskId}`);

    // actionAdvanceStage inlined
    const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.taskId });
    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.taskId}`);
    const currentMark = matter.mark ?? 0;
    const formResult = await readForm({ scope: input.scope, id: matter.form });
    const pipeline = formResult.rows[0];
    if (pipeline?.data) {
      const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
      const transitions = pipelineData.transitions || {};
      const key = `${currentMark}→6`;
      if (transitions[key] === undefined && transitions[`any→6`] === undefined) {
        throw new Error(`Invalid transition: ${currentMark} → 6`);
      }
    }
    await appendMotion({
      stream: input.taskId, action: 70004, phase: 6,
      data: { event: 'stage_advanced', from: currentMark, to: 6 },
      scope: input.scope,
    });
    await updateMatter({
      table: 'matter', id: input.taskId, scope: input.scope,
      patch: { mark: 6 }, phase: 6,
      reason: `Advanced from ${currentMark} to 6`,
    });

    await setAttr({
      matterId: input.taskId, key: 'status', val: 'done', scope: input.scope,
    });

    await appendMotion({
      stream: input.taskId, action: 99993,
      data: { event: 'task_completed', by: input.completedBy },
      scope: input.scope,
    });

    return { completed: true };
  },
});
