import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Create a reservation for a time slot.
 * @param input - Booking details
 * @param input.resourceId - Resource to reserve
 * @param input.start - Slot start time (ISO string)
 * @param input.end - Slot end time (ISO string)
 * @param input.customerName - Optional customer name
 * @param input.scope - Tenant scope
 * @returns Reservation ID
 */
export async function actionBookSlot(input: {
  resourceId: string;
  start: string;
  end: string;
  customerName?: string;
  scope: string;
}): Promise<{ reservationId: string }> {
  const reservationId = `res_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'reservation',
    title: `Reservation ${input.resourceId}`, start: input.start, end: input.end,
    data: { resource: input.resourceId, customer: input.customerName },
  });

  await setAttr({ matterId: reservationId, key: 'status', val: 'booked', scope: input.scope });

  await appendMotion({
    stream: reservationId, action: 99993,
    data: { event: 'slot_booked', resource: input.resourceId, start: input.start, end: input.end },
    scope: input.scope,
  });

  return { reservationId };
}
