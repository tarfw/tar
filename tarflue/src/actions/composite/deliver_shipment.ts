import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

export const actionDeliverShipment = defineAction({
  name: 'action_deliver_shipment',
  description: 'Mark a shipment as delivered and notify.',
  input: v.object({
    shipmentId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ delivered: v.boolean() }),
  async run({ input, log }) {
    log.info(`Delivering shipment ${input.shipmentId}`);

    // actionAdvanceStage inlined
    const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.shipmentId });
    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.shipmentId}`);
    const currentMark = matter.mark ?? 0;
    const formResult = await readForm({ scope: input.scope, id: matter.form });
    const pipeline = formResult.rows[0];
    if (pipeline?.data) {
      const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
      const transitions = pipelineData.transitions || {};
      const key = `${currentMark}→4`;
      if (transitions[key] === undefined && transitions[`any→4`] === undefined) {
        throw new Error(`Invalid transition: ${currentMark} → 4`);
      }
    }
    await appendMotion({
      stream: input.shipmentId, action: 410, phase: 4,
      data: { event: 'stage_advanced', from: currentMark, to: 4 },
      scope: input.scope,
    });
    await updateMatter({
      table: 'matter', id: input.shipmentId, scope: input.scope,
      patch: { mark: 4 }, phase: 4,
      reason: `Advanced from ${currentMark} to 4`,
    });

    await setAttr({
      matterId: input.shipmentId, key: 'status', val: 'delivered', scope: input.scope,
    });

    await appendMotion({
      stream: input.shipmentId, action: 99993,
      data: { event: 'shipment_delivered' }, scope: input.scope,
    });

    // actionNotify inlined
    const channelResult = await readForm({ scope: input.scope, type: 'channel' });
    const channelConfig = channelResult.rows.find(
      (r: any) => r.id === 'email' || r.data?.provider === 'email'
    );
    if (channelConfig) {
      log.info(`Found channel config for email, would send via provider`);
    }
    await appendMotion({
      stream: input.shipmentId, action: 99993,
      data: { event: 'notification', channel: 'email', template: 'shipment-delivered', shipmentId: input.shipmentId },
      scope: input.scope,
    });

    return { delivered: true };
  },
});
