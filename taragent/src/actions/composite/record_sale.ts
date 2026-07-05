import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Record a POS sale with payment details.
 * @param input - Sale details
 * @param input.storeId - Store identifier
 * @param input.items - Line items with name, price, qty
 * @param input.paymentMethod - Payment method
 * @param input.scope - Tenant scope
 * @returns Sale ID and total
 */
export async function actionRecordSale(input: {
  storeId: string;
  items: Array<{ name: string; price: number; qty: number }>;
  paymentMethod: string;
  scope: string;
}): Promise<{ saleId: string; total: number }> {
  const saleId = `sale_${Date.now()}`;
  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  await createMatter({
    table: 'matter', scope: input.scope, type: 'payment',
    title: `Sale #${saleId}`, value: total,
    data: { storeId: input.storeId, items: input.items, paymentMethod: input.paymentMethod },
  });

  await setAttr({ matterId: saleId, key: 'status', val: 'completed', scope: input.scope });
  await setAttr({ matterId: saleId, key: 'total', num: total, scope: input.scope });

  for (const item of input.items) {
    await setAttr({
      matterId: item.name, key: `stock-${input.storeId}`, num: -item.qty, scope: input.scope,
    });
  }

  await appendMotion({
    stream: saleId, action: 99993,
    data: { event: 'sale_recorded', total, items: input.items.length, paymentMethod: input.paymentMethod },
    scope: input.scope,
  });

  return { saleId, total };
}
