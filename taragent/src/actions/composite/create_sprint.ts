import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Create a new sprint with capacity and date range.
 * @param input - Sprint details
 * @param input.title - Sprint title (required, non-empty)
 * @param input.projectId - Parent project ID
 * @param input.start - Start date (ISO string)
 * @param input.end - End date (ISO string)
 * @param input.capacity - Sprint capacity in points (optional)
 * @param input.scope - Tenant scope
 * @returns Sprint matter ID
 */
export async function actionCreateSprint(input: {
  title: string;
  projectId: string;
  start: string;
  end: string;
  capacity?: number;
  scope: string;
}): Promise<{ sprintId: string }> {
  const sprintId = `sprint_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'sprint',
    title: input.title, start: input.start, end: input.end,
    data: { project: input.projectId, capacity: input.capacity },
  });

  await setAttr({ matterId: sprintId, key: 'status', val: 'planning', scope: input.scope });
  if (input.capacity) {
    await setAttr({ matterId: sprintId, key: 'capacity', num: input.capacity, scope: input.scope });
  }

  await appendMotion({
    stream: sprintId, action: 99993,
    data: { event: 'sprint_created', title: input.title, project: input.projectId },
    scope: input.scope,
  });

  return { sprintId };
}
