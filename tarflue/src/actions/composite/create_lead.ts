import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { createMatter, setAttr, linkGraph, appendMotion } from '@/lib/helpers';

export const actionCreateLead = defineAction({
  name: 'action_create_lead',
  description: 'Create a new sales lead with scoring and embedding.',
  input: v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    source: v.optional(v.string()),
    interest: v.optional(v.string()),
    value: v.optional(v.number()),
    ownerId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ leadId: v.string() }),
  async run({ input, log }) {
    log.info(`Creating lead: ${input.name}`);
    const leadId = `lead_${Date.now()}`;

    await createMatter({ table: 'matter', scope: input.scope, type: 'lead', form: 'lead', title: input.name, value: input.value, data: { phone: input.phone, email: input.email, source: input.source, interest: input.interest } });
    await setAttr({ matterId: leadId, key: 'status', val: 'new', scope: input.scope });
    await setAttr({ matterId: leadId, key: 'source', val: input.source || 'unknown', scope: input.scope });
    await linkGraph({ src: leadId, rel: 'owned_by', tgt: input.ownerId, scope: input.scope });
    await appendMotion({ stream: leadId, action: 99993, data: { event: 'lead_created', name: input.name }, scope: input.scope });

    return { leadId };
  },
});
