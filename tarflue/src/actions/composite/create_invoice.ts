import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

export const actionCreateInvoice = defineAction({
  name: 'action_create_invoice',
  description: 'Create an invoice for a customer.',
  input: v.object({
    customerId: v.string(),
    items: v.array(v.object({ name: v.string(), amount: v.number() })),
    scope: v.string(),
  }),
  output: v.object({ invoiceId: v.string(), total: v.number() }),
  async run({ input, log }) {
    log.info(`Creating invoice for ${input.customerId}`);

    const invoiceId = `inv_${Date.now()}`;
    const total = input.items.reduce((sum, item) => sum + item.amount, 0);

    await createMatter({
      table: 'matter', scope: input.scope, type: 'invoice',
      title: `Invoice #${invoiceId}`, value: total,
      data: { customerId: input.customerId, items: input.items },
    });

    await setAttr({ matterId: invoiceId, key: 'status', val: 'draft', scope: input.scope });
    await linkGraph({ src: input.customerId, rel: 'has_invoice', tgt: invoiceId, scope: input.scope });

    await appendMotion({
      stream: invoiceId, action: 99993,
      data: { event: 'invoice_created', customer: input.customerId, total },
      scope: input.scope,
    });

    return { invoiceId, total };
  },
});
