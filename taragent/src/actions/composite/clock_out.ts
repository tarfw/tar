import { setAttr, appendMotion, getMatter, readForm, updateMatter } from '@/lib/helpers';

/**
 * Record employee clock-out for attendance.
 * @param input - Clock-out details
 * @param input.attendanceId - Attendance record ID
 * @param input.scope - Tenant scope
 * @returns Whether clocked out successfully
 */
export async function actionClockOut(input: {
  attendanceId: string;
  scope: string;
}): Promise<{ clockedOut: boolean }> {
  const matterResult = await getMatter({ table: 'matter', scope: input.scope, id: input.attendanceId });
  const matter = matterResult.rows[0];
  if (!matter) throw new Error(`Matter not found: ${input.attendanceId}`);
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
    stream: input.attendanceId, action: 502, phase: 2,
    data: { event: 'stage_advanced', from: currentMark, to: 2 },
    scope: input.scope,
  });
  await updateMatter({
    table: 'matter', id: input.attendanceId, scope: input.scope,
    patch: { mark: 2 }, phase: 2,
    reason: `Advanced from ${currentMark} to 2`,
  });

  await setAttr({
    matterId: input.attendanceId, key: 'status', val: 'out', scope: input.scope,
  });

  await appendMotion({
    stream: input.attendanceId, action: 99993,
    data: { event: 'clock_out', clockOut: new Date().toISOString() },
    scope: input.scope,
  });

  return { clockedOut: true };
}
