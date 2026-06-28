import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionCreateShipment = defineAction({
  name: 'action_create_shipment',
  description: 'Create a new shipment with destination and items.',
  input: v.object({
    destination: v.pipe(v.string(), v.minLength(1)),
    items: v.array(v.string()),
    scope: v.string(),
  }),
  output: v.object({ shipmentId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Creating shipment to ${input.destination}`);

    const shipmentId = `shipment_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'shipment',
      title: `Shipment to ${input.destination}`,
      data: { destination: input.destination, items: input.items },
    });

    await harness.tools.call(toolSetAttr, { matterId: shipmentId, key: 'status', val: 'pending', scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: shipmentId, action: 99993,
      data: { event: 'shipment_created', destination: input.destination, items: input.items },
      scope: input.scope,
    });

    return { shipmentId };
  },
});
