import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Record employee clock-in for attendance.
 * @param input - Clock-in details
 * @param input.employeeId - Employee identifier
 * @param input.scope - Tenant scope
 * @returns Attendance record ID
 */
export async function actionClockIn(input: {
  employeeId: string;
  scope: string;
}): Promise<{ attendanceId: string }> {
  const attendanceId = `att_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'attendance',
    title: `Attendance ${input.employeeId}`,
    data: { employee: input.employeeId, clockIn: new Date().toISOString() },
  });

  await setAttr({ matterId: attendanceId, key: 'status', val: 'in', scope: input.scope });

  await appendMotion({
    stream: attendanceId, action: 99993,
    data: { event: 'clock_in', employee: input.employeeId },
    scope: input.scope,
  });

  return { attendanceId };
}
