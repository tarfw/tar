import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

/**
 * Mark an invoice as paid.
 * @param input - Payment details
 * @param input.invoiceId - Invoice matter ID
 * @param input.scope - Tenant scope
 * @returns Whether invoice was paid
 */
export async function actionPayInvoice(input: {
  invoiceId: string;
  scope: string;
}): Promise<{ paid: boolean }> {
  const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.invoiceId });
  const matter = matterResult.rows[0];
  if (!matter) throw new Error(`Matter not found: ${input.invoiceId}`);
  const currentMark = matter.mark ?? 0;
  const formResult = await readForm({ scope: input.scope, id: matter.form });
  const pipeline = formResult.rows[0];
  if (pipeline?.data) {
    const pipelineData = typeof pipeline.data === 'string' ? JSON.parse(pipeline.data) : pipeline.data;
    const transitions = pipelineData.transitions || {};
    const key = `${currentMark}→2`;
    if (transitions[key] === undefined && transitions[`any→2`] === undefined) {
      throw new Error(`Invalid transition: ${currentMark} → 2`);
    }
  }
  await appendMotion({
    stream: input.invoiceId, action: 8002, phase: 2,
    data: { event: 'stage_advanced', from: currentMark, to: 2 },
    scope: input.scope,
  });
  await updateMatter({
    table: 'matter', id: input.invoiceId, scope: input.scope,
    patch: { mark: 2 }, phase: 2,
    reason: `Advanced from ${currentMark} to 2`,
  });

  await setAttr({
    matterId: input.invoiceId, key: 'status', val: 'paid', scope: input.scope,
  });

  await appendMotion({
    stream: input.invoiceId, action: 99993,
    data: { event: 'invoice_paid' }, scope: input.scope,
  });

  return { paid: true };
}
