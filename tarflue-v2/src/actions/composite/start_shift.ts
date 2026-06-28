import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Open a new cashier shift at a register.
 * @param input - Shift start details
 * @param input.registerId - Register identifier
 * @param input.cashierId - Cashier person ID
 * @param input.startingCash - Starting cash amount
 * @param input.scope - Tenant scope
 * @returns Shift matter ID
 */
export async function actionStartShift(input: {
  registerId: string;
  cashierId: string;
  startingCash: number;
  scope: string;
}): Promise<{ shiftId: string }> {
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
}
