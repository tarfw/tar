import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolGetMatter } from '@/tools/core/get_matter';
import { toolUpdateMatter } from '@/tools/core/update_matter';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { toolReadForm } from '@/tools/core/read_form';

export const actionAdvanceStage = defineAction({
  name: 'action_advance_stage',
  description: 'Validate pipeline transition, log the event, and update the matter stage.',
  input: v.object({
    matterId: v.string(),
    targetPhase: v.number(),
    actionCode: v.number(),
    scope: v.string(),
  }),
  output: v.object({ advanced: v.boolean(), from: v.number(), to: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Advancing ${input.matterId} to phase ${input.targetPhase}`);

    const matterResult = await harness.tools.call(toolGetMatter, {
      table: 'matter',
      scope: input.scope,
      id: input.matterId,
    });

    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

    const currentMark = matter.mark ?? 0;

    const formResult = await harness.tools.call(toolReadForm, {
      scope: input.scope,
      id: matter.form,
    });

    const pipeline = formResult.rows[0];
    if (pipeline?.data) {
      const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
      const transitions = pipelineData.transitions || {};
      const key = `${currentMark}→${input.targetPhase}`;
      if (transitions[key] === undefined && transitions[`any→${input.targetPhase}`] === undefined) {
        throw new Error(`Invalid transition: ${currentMark} → ${input.targetPhase}`);
      }
    }

    await harness.tools.call(toolAppendMotion, {
      stream: input.matterId,
      action: input.actionCode,
      phase: input.targetPhase,
      data: { event: 'stage_advanced', from: currentMark, to: input.targetPhase },
      scope: input.scope,
    });

    await harness.tools.call(toolUpdateMatter, {
      table: 'matter',
      id: input.matterId,
      scope: input.scope,
      patch: { mark: input.targetPhase },
      phase: input.targetPhase,
      reason: `Advanced from ${currentMark} to ${input.targetPhase}`,
    });

    return { advanced: true, from: currentMark, to: input.targetPhase };
  },
});
