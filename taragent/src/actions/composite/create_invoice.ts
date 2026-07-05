import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

/**
 * Create an invoice for a customer.
 * @param input - Invoice details
 * @param input.customerId - Customer matter ID
 * @param input.items - Line items with name and amount
 * @param input.scope - Tenant scope
 * @returns Invoice ID and total
 */
export async function actionCreateInvoice(input: {
  customerId: string;
  items: Array<{ name: string; amount: number }>;
  scope: string;
}): Promise<{ invoiceId: string; total: number }> {
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
}
