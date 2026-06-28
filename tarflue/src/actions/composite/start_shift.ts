import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

export const actionStartShift = defineAction({
  name: 'action_start_shift',
  description: 'Open a new cashier shift at a register.',
  input: v.object({
    registerId: v.string(),
    cashierId: v.string(),
    startingCash: v.number(),
    scope: v.string(),
  }),
  output: v.object({ shiftId: v.string() }),
  async run({ input, log }) {
    log.info(`Starting shift at register ${input.registerId}`);

    const shiftId = `shift_${Date.now()}`;
    await createMatter({
      table: 'matter', scope: input.scope, type: 'shift',
      title: `Shift ${input.registerId}`, value: input.startingCash,
      data: { register: input.registerId, cashier: input.cashierId, startingCash: input.startingCash },
    });

    await setAttr({ matterId: shiftId, key: 'status', val: 'open', scope: input.scope });
    await setAttr({ matterId: shiftId, key: 'starting_cash', num: input.startingCash, scope: input.scope });

    await appendMotion({
      stream: shiftId, action: 99993,
      data: { event: 'shift_started', register: input.registerId, cashier: input.cashierId, startingCash: input.startingCash },
      scope: input.scope,
    });

    return { shiftId };
  },
});
