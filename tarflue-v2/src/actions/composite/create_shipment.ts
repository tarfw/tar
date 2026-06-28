import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Create a new shipment with destination and items.
 * @param input - Shipment details
 * @param input.destination - Destination address (required, non-empty)
 * @param input.items - List of item IDs
 * @param input.scope - Tenant scope
 * @returns Shipment matter ID
 */
export async function actionCreateShipment(input: {
  destination: string;
  items: string[];
  scope: string;
}): Promise<{ shipmentId: string }> {
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
}
