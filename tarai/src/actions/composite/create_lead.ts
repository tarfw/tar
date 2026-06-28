import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolLinkGraph } from '@/tools/core/link_graph';
import { toolAppendMotion } from '@/tools/core/append_motion';
import { actionScore } from '@/actions/core/score';
import { actionEmbed } from '@/actions/core/embed';

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
  output: v.object({ leadId: v.string(), score: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Creating lead: ${input.name}`);

    const leadId = `lead_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter',
      scope: input.scope,
      type: 'lead',
      form: 'lead',
      title: input.name,
      value: input.value,
      data: { phone: input.phone, email: input.email, source: input.source, interest: input.interest },
    });

    await harness.tools.call(toolSetAttr, { matterId: leadId, key: 'status', val: 'new', scope: input.scope });
    await harness.tools.call(toolSetAttr, { matterId: leadId, key: 'source', val: input.source || 'unknown', scope: input.scope });
    await harness.tools.call(toolLinkGraph, { src: leadId, rel: 'owned_by', tgt: input.ownerId, scope: input.scope });

    await harness.tools.call(toolAppendMotion, {
      stream: leadId, action: 99993,
      data: { event: 'lead_created', name: input.name, source: input.source },
      scope: input.scope,
    });

    const scoreResult = await harness.actions.call(actionScore, {
      matterId: leadId, scope: input.scope, criteria: 'purchase intent, budget, urgency',
    });

    await harness.actions.call(actionEmbed, {
      matterId: leadId, scope: input.scope,
      text: `${input.name} interested in ${input.interest || 'general inquiry'} from ${input.source || 'unknown'}`,
    });

    return { leadId, score: scoreResult.score };
  },
});
