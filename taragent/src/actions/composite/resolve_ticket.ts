import { setAttr, getMatter, readForm, appendMotion, updateMatter } from '@/lib/helpers';

/**
 * Mark a support ticket as resolved.
 * @param input - Resolution details
 * @param input.ticketId - Ticket matter ID
 * @param input.resolution - Resolution notes (optional)
 * @param input.scope - Tenant scope
 * @returns Whether ticket was resolved
 */
export async function actionResolveTicket(input: {
  ticketId: string;
  resolution?: string;
  scope: string;
}): Promise<{ resolved: boolean }> {
  const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.ticketId });
  const matter = matterResult.rows[0];
  if (!matter) throw new Error(`Matter not found: ${input.ticketId}`);
  const currentMark = matter.mark ?? 0;
  const formResult = await readForm({ scope: input.scope, id: matter.form });
  const pipeline = formResult.rows[0];
  if (pipeline?.data) {
    const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
    const transitions = pipelineData.transitions || {};
    const key = `${currentMark}→6`;
    if (transitions[key] === undefined && transitions[`any→6`] === undefined) {
      throw new Error(`Invalid transition: ${currentMark} → 6`);
    }
  }
  await appendMotion({
    stream: input.ticketId, action: 99993, phase: 6,
    data: { event: 'stage_advanced', from: currentMark, to: 6 },
    scope: input.scope,
  });
  await updateMatter({
    table: 'matter', id: input.ticketId, scope: input.scope,
    patch: { mark: 6 }, phase: 6,
    reason: `Advanced from ${currentMark} to 6`,
  });

  await setAttr({
    matterId: input.ticketId, key: 'status', val: 'resolved', scope: input.scope,
  });

  return { resolved: true };
}
