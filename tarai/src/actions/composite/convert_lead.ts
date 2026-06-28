import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

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
  async run({ harness, input, log }) {
    log.info(`Converting lead ${input.leadId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.leadId, targetPhase: 6, actionCode: 80003, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, { matterId: input.leadId, key: 'status', val: 'won', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: input.leadId, key: 'deal_value', num: input.dealValue, scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: input.leadId, action: 99993,
      data: { event: 'lead_converted', deal_value: input.dealValue, notes: input.notes },
      scope: input.scope,
    });

    return { converted: true, leadId: input.leadId };
  },
});
