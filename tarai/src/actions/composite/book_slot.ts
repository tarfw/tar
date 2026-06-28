import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionBookSlot = defineAction({
  name: 'action_book_slot',
  description: 'Create a reservation for a time slot.',
  input: v.object({
    resourceId: v.string(),
    start: v.string(),
    end: v.string(),
    customerName: v.optional(v.string()),
    scope: v.string(),
  }),
  output: v.object({ reservationId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Booking slot for ${input.resourceId}`);

    const reservationId = `res_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'reservation',
      title: `Reservation ${input.resourceId}`, start: input.start, end: input.end,
      data: { resource: input.resourceId, customer: input.customerName },
    });

    await harness.tools.call(toolSetAttr, { matterId: reservationId, key: 'status', val: 'booked', scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: reservationId, action: 99993,
      data: { event: 'slot_booked', resource: input.resourceId, start: input.start, end: input.end },
      scope: input.scope,
    });

    return { reservationId };
  },
});
