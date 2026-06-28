import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

export const actionCreateShipment = defineAction({
  name: 'action_create_shipment',
  description: 'Create a new shipment with destination and items.',
  input: v.object({
    destination: v.pipe(v.string(), v.minLength(1)),
    items: v.array(v.string()),
    scope: v.string(),
  }),
  output: v.object({ shipmentId: v.string() }),
  async run({ input, log }) {
    log.info(`Creating shipment to ${input.destination}`);

    const shipmentId = `shipment_${Date.now()}`;
    await createMatter({
      table: 'matter', scope: input.scope, type: 'shipment',
      title: `Shipment to ${input.destination}`,
      data: { destination: input.destination, items: input.items },
    });

    await setAttr({ matterId: shipmentId, key: 'status', val: 'pending', scope: input.scope });

    await appendMotion({
      stream: shipmentId, action: 99993,
      data: { event: 'shipment_created', destination: input.destination, items: input.items },
      scope: input.scope,
    });

    return { shipmentId };
  },
});
