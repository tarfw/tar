import { createMatter, setAttr, appendMotion } from '@/lib/helpers';

/**
 * Create a new project with metadata.
 * @param input - Project details
 * @param input.title - Project title (required, non-empty)
 * @param input.description - Description (optional)
 * @param input.start - Start date (optional)
 * @param input.end - End date (optional)
 * @param input.scope - Tenant scope
 * @returns Project matter ID
 */
export async function actionCreateProject(input: {
  title: string;
  description?: string;
  start?: string;
  end?: string;
  scope: string;
}): Promise<{ projectId: string }> {
  const projectId = `project_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'project',
    title: input.title, start: input.start, end: input.end,
    data: { description: input.description },
  });

  await setAttr({ matterId: projectId, key: 'status', val: 'active', scope: input.scope });

  await appendMotion({
    stream: projectId, action: 99993,
    data: { event: 'project_created', title: input.title },
    scope: input.scope,
  });

  return { projectId };
}
