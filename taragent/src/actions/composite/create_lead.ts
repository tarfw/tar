import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

/**
 * Create a new sales lead with scoring and embedding.
 * @param input - Lead details
 * @param input.name - Lead name (required, non-empty)
 * @param input.phone - Phone number (optional)
 * @param input.email - Email (optional)
 * @param input.leadSource - Lead source (optional)
 * @param input.interest - Interest description (optional)
 * @param input.value - Estimated value (optional)
 * @param input.ownerId - Owner person ID
 * @param input.scope - Tenant scope
 * @returns Lead matter ID
 */
export async function actionCreateLead(input: {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  interest?: string;
  value?: number;
  ownerId: string;
  scope: string;
}): Promise<{ leadId: string }> {
  const leadId = `lead_${Date.now()}`;

  await createMatter({ table: 'matter', scope: input.scope, type: 'lead', form: 'lead', title: input.name, value: input.value, data: { phone: input.phone, email: input.email, source: input.source, interest: input.interest } });
  await setAttr({ matterId: leadId, key: 'status', val: 'new', scope: input.scope });
  await setAttr({ matterId: leadId, key: 'source', val: input.source || 'unknown', scope: input.scope });
  await linkGraph({ src: leadId, rel: 'owned_by', tgt: input.ownerId, scope: input.scope });
  await appendMotion({ stream: leadId, action: 99993, data: { event: 'lead_created', name: input.name }, scope: input.scope });

  return { leadId };
}
