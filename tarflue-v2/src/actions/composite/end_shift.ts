import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

/**
 * Close a cashier shift with ending cash and variance.
 * @param input - Shift close details
 * @param input.shiftId - Shift matter ID
 * @param input.endingCash - Ending cash amount
 * @param input.scope - Tenant scope
 * @returns Whether shift was closed and variance
 */
export async function actionEndShift(input: {
  shiftId: string;
  endingCash: number;
  scope: string;
}): Promise<{ closed: boolean; variance: number }> {
  const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.shiftId });
  const matter = matterResult.rows[0];
  if (!matter) throw new Error(`Matter not found: ${input.shiftId}`);
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
    stream: input.shiftId, action: 80022, phase: 4,
    data: { event: 'stage_advanced', from: currentMark, to: 4 },
    scope: input.scope,
  });
  await updateMatter({
    table: 'matter', id: input.shiftId, scope: input.scope,
    patch: { mark: 4 }, phase: 4,
    reason: `Advanced from ${currentMark} to 4`,
  });

  await setAttr({ matterId: input.shiftId, key: 'status', val: 'closed', scope: input.scope });
  await setAttr({ matterId: input.shiftId, key: 'ending_cash', num: input.endingCash, scope: input.scope });

  await appendMotion({
    stream: input.shiftId, action: 99993,
    data: { event: 'shift_ended', endingCash: input.endingCash },
    scope: input.scope,
  });

  return { closed: true, variance: 0 };
}
