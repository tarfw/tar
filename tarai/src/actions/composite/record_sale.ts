import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionRecordSale = defineAction({
  name: 'action_record_sale',
  description: 'Record a POS sale with payment details.',
  input: v.object({
    storeId: v.string(),
    items: v.array(v.object({ name: v.string(), price: v.number(), qty: v.number() })),
    paymentMethod: v.string(),
    scope: v.string(),
  }),
  output: v.object({ saleId: v.string(), total: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Recording sale at ${input.storeId}`);

    const saleId = `sale_${Date.now()}`;
    const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'payment',
      title: `Sale #${saleId}`, value: total,
      data: { storeId: input.storeId, items: input.items, paymentMethod: input.paymentMethod },
    });

    await harness.tools.call(toolSetAttr, { matterId: saleId, key: 'status', val: 'completed', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: saleId, key: 'total', num: total, scope: input.scope });

    for (const item of input.items) {
      await harness.tools.call(toolSetAttr, {
        matterId: item.name, key: `stock-${input.storeId}`, num: -item.qty, scope: input.scope,
      });
    }

    await harness.tools.call(toolAppendMotion, {
      stream: saleId, action: 99993,
      data: { event: 'sale_recorded', total, items: input.items.length, paymentMethod: input.paymentMethod },
      scope: input.scope,
    });

    return { saleId, total };
  },
});
