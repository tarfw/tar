import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolReadForm } from '@/tools/core/read_form';
import { toolGetMatter } from '@/tools/core/get_matter';
import { toolUpdateMatter } from '@/tools/core/update_matter';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionRunPipeline = defineAction({
  name: 'action_run_pipeline',
  description: 'Execute a pipeline defined in form.type=pipeline. Validates transitions and advances stages.',
  input: v.object({
    matterId: v.string(),
    pipelineId: v.string(),
    targetPhase: v.number(),
    actionCode: v.number(),
    scope: v.string(),
    data: v.optional(v.record(v.string(), v.any())),
  }),
  output: v.object({ completed: v.boolean(), phase: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Running pipeline ${input.pipelineId} for ${input.matterId}`);

    const pipelineResult = await harness.tools.call(toolReadForm, {
      scope: input.scope,
      id: input.pipelineId,
    });

    const pipeline = pipelineResult.rows[0];
    if (!pipeline) throw new Error(`Pipeline not found: ${input.pipelineId}`);

    const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
    const stages = pipelineData.stages || [];
    const transitions = pipelineData.transitions || {};

    const matterResult = await harness.tools.call(toolGetMatter, {
      table: 'matter',
      scope: input.scope,
      id: input.matterId,
    });

    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

    const currentMark = matter.mark ?? 0;
    const targetStage = stages.find((s: any) => s.phase === input.targetPhase);
    if (!targetStage) throw new Error(`Invalid target phase: ${input.targetPhase}`);

    const transitionKey = `${currentMark}→${input.targetPhase}`;
    const anyKey = `any→${input.targetPhase}`;
    if (transitions[transitionKey] === undefined && transitions[anyKey] === undefined) {
      throw new Error(`Invalid transition: ${currentMark} → ${input.targetPhase}`);
    }

    await harness.tools.call(toolAppendMotion, {
      stream: input.matterId,
      action: input.actionCode,
      phase: input.targetPhase,
      data: { event: 'pipeline_advanced', pipeline: input.pipelineId, from: currentMark, to: input.targetPhase },
      scope: input.scope,
    });

    await harness.tools.call(toolUpdateMatter, {
      table: 'matter',
      id: input.matterId,
      scope: input.scope,
      patch: { mark: input.targetPhase, data: input.data },
      phase: input.targetPhase,
      reason: `Pipeline ${input.pipelineId}: ${currentMark} → ${input.targetPhase}`,
    });

    return { completed: true, phase: input.targetPhase };
  },
});
