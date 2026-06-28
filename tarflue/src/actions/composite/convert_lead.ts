import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

export const actionConvertLead = defineAction({
  name: 'action_convert_lead',
  description: 'Convert a sales lead to a customer or opportunity.',
  input: v.object({
    leadId: v.string(),
    dealValue: v.number(),
    notes: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ converted: v.boolean(), leadId: v.string() }),
  async run({ input, log }) {
    log.info(`Converting lead ${input.leadId}`);

    // actionAdvanceStage inlined
    const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.leadId });
    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.leadId}`);
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
      stream: input.leadId, action: 80003, phase: 6,
      data: { event: 'stage_advanced', from: currentMark, to: 6 },
      scope: input.scope,
    });
    await updateMatter({
      table: 'matter', id: input.leadId, scope: input.scope,
      patch: { mark: 6 }, phase: 6,
      reason: `Advanced from ${currentMark} to 6`,
    });

    await setAttr({ matterId: input.leadId, key: 'status', val: 'won', scope: input.scope });
    await setAttr({ matterId: input.leadId, key: 'deal_value', num: input.dealValue, scope: input.scope });

    await appendMotion({
      stream: input.leadId, action: 99993,
      data: { event: 'lead_converted', deal_value: input.dealValue, notes: input.notes },
      scope: input.scope,
    });

    return { converted: true, leadId: input.leadId };
  },
});
