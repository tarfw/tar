import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, linkGraph, appendMotion, readForm, getMatter, updateMatter } from '@/lib/helpers';

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
  async run({ input, log }) {
    log.info(`Processing checkout for ${input.items.length} items`);

    const orderId = `order_${Date.now()}`;
    const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);

    await createMatter({
      table: 'matter', scope: input.scope, type: 'order',
      title: `Order #${orderId}`, value: total,
      data: { storeId: input.storeId, items: input.items, email: input.email, paymentMethod: input.paymentMethod },
    });

    for (const item of input.items) {
      await linkGraph({
        src: orderId, rel: 'contains', tgt: item.name, scope: input.scope,
      });
    }

    await setAttr({ matterId: orderId, key: 'status', val: 'pending_payment', scope: input.scope });
    await setAttr({ matterId: orderId, key: 'total', num: total, scope: input.scope });

    // actionRunPipeline inlined
    const pipelineId = 'pipeline-order';
    const targetPhase = 3;
    const actionCode = 80011;
    const pipelineResult = await readForm({ scope: input.scope, id: pipelineId });
    const pipeline = pipelineResult.rows[0];
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
    const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
    const stages = pipelineData.stages || [];
    const transitions = pipelineData.transitions || {};
    const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: orderId });
    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${orderId}`);
    const currentMark = matter.mark ?? 0;
    const targetStage = stages.find((s: any) => s.phase === targetPhase);
    if (!targetStage) throw new Error(`Invalid target phase: ${targetPhase}`);
    const transitionKey = `${currentMark}→${targetPhase}`;
    const anyKey = `any→${targetPhase}`;
    if (transitions[transitionKey] === undefined && transitions[anyKey] === undefined) {
      throw new Error(`Invalid transition: ${currentMark} → ${targetPhase}`);
    }
    await appendMotion({
      stream: orderId, action: actionCode, phase: targetPhase,
      data: { event: 'pipeline_advanced', pipeline: pipelineId, from: currentMark, to: targetPhase },
      scope: input.scope,
    });
    await updateMatter({
      table: 'matter', id: orderId, scope: input.scope,
      patch: { mark: targetPhase }, phase: targetPhase,
      reason: `Pipeline ${pipelineId}: ${currentMark} → ${targetPhase}`,
    });

    for (const item of input.items) {
      await setAttr({
        matterId: item.name, key: `stock-${input.storeId}`, num: -item.qty, scope: input.scope,
      });
    }

    const notifyTo = input.email || input.storeId;
    const channelResult = await readForm({ scope: input.scope, type: 'channel' });
    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === 'email' || r.data?.provider === 'email'
    );
    if (channelConfig) {
      log.info(`Found channel config for email, would send via provider`);
    }
    await appendMotion({
      stream: notifyTo, action: 99993,
      data: { event: 'notification', channel: 'email', template: 'order-receipt', orderId, items: input.items, total },
      scope: input.scope,
    });

    await appendMotion({
      stream: orderId, action: 99993,
      data: { event: 'checkout_completed', total, items: input.items.length },
      scope: input.scope,
    });

    return { orderId, total, success: true };
  },
});
