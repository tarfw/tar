import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolLinkGraph } from '@/tools/core/link_graph';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionRunPipeline } from '@/actions/core/run_pipeline';
import { actionNotify } from '@/actions/core/notify';

export const actionCheckout = defineAction({
  name: 'action_checkout',
  description: 'Process a sale: create order, calculate total, capture payment, update inventory.',
  input: v.object({
    storeId: v.string(),
    items: v.array(v.object({ name: v.string(), price: v.number(), qty: v.number() })),
    email: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ orderId: v.string(), total: v.number(), success: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Processing checkout for ${input.items.length} items`);

    const orderId = `order_${Date.now()}`;
    const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'order',
      title: `Order #${orderId}`, value: total,
      data: { storeId: input.storeId, items: input.items, email: input.email, paymentMethod: input.paymentMethod },
    });

    for (const item of input.items) {
      await harness.tools.call(toolLinkGraph, {
        src: orderId, rel: 'contains', tgt: item.name, scope: input.scope,
      });
    }

    await harness.tools.call(toolSetAttr, { matterId: orderId, key: 'status', val: 'pending_payment', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: orderId, key: 'total', num: total, scope: input.scope });

    await harness.actions.call(actionRunPipeline, {
      matterId: orderId, pipelineId: 'pipeline-order', targetPhase: 3, actionCode: 80011, scope: input.scope,
    });

    for (const item of input.items) {
      await harness.tools.call(toolSetAttr, {
        matterId: item.name, key: `stock-${input.storeId}`, num: -item.qty, scope: input.scope,
      });
    }

    await harness.actions.call(actionNotify, {
      to: input.email || input.storeId, channel: 'email', template: 'order-receipt',
      data: { orderId, items: input.items, total }, scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: orderId, action: 99993,
      data: { event: 'checkout_completed', total, items: input.items.length },
      scope: input.scope,
    });

    return { orderId, total, success: true };
  },
});
