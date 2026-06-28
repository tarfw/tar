import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionPayInvoice = defineAction({
  name: 'action_pay_invoice',
  description: 'Mark an invoice as paid.',
  input: v.object({
    invoiceId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ paid: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Paying invoice ${input.invoiceId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.invoiceId, targetPhase: 2, actionCode: 8002, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, {
      matterId: input.invoiceId, key: 'status', val: 'paid', scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: input.invoiceId, action: 99993,
      data: { event: 'invoice_paid' }, scope: input.scope,
    });

    return { paid: true };
  },
});
