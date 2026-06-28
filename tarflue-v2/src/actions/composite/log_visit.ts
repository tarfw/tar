import { createMatter, appendMotion } from '@/lib/helpers';

/**
 * Record a customer visit to the store.
 * @param input - Visit details
 * @param input.person - Visitor name (required, non-empty)
 * @param input.notes - Visit notes (optional)
 * @param input.rating - Visit rating (optional)
 * @param input.scope - Tenant scope
 * @returns Visit matter ID
 */
export async function actionLogVisit(input: {
  person: string;
  notes?: string;
  rating?: number;
  scope: string;
}): Promise<{ visitId: string }> {
  const visitId = `visit_${Date.now()}`;
  await createMatter({
    table: 'matter',
    scope: input.scope,
    type: 'visit',
    title: `Visit: ${input.person}`,
    data: { notes: input.notes, rating: input.rating },
  });

  await appendMotion({
    stream: visitId, action: 99993,
    data: { event: 'visit_logged', person: input.person, rating: input.rating },
    scope: input.scope,
  });

  return { visitId };
}
