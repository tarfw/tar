import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { actionAdvanceStage } from '@/actions/core/advance_stage';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionNotify } from '@/actions/core/notify';

export const actionDeliverShipment = defineAction({
  name: 'action_deliver_shipment',
  description: 'Mark a shipment as delivered and notify.',
  input: v.object({
    shipmentId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ delivered: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Delivering shipment ${input.shipmentId}`);

    await harness.actions.call(actionAdvanceStage, {
      matterId: input.shipmentId, targetPhase: 4, actionCode: 410, scope: input.scope,
    });

    await harness.tools.call(toolSetAttr, {
      matterId: input.shipmentId, key: 'status', val: 'delivered', scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: input.shipmentId, action: 99993,
      data: { event: 'shipment_delivered' }, scope: input.scope,
    });

    await harness.actions.call(actionNotify, {
      to: input.shipmentId, channel: 'email', template: 'shipment-delivered',
      data: { shipmentId: input.shipmentId }, scope: input.scope,
    });

    return { delivered: true };
  },
});
