import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { listMatters } from '@/lib/helpers';

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({
  model: 'groq/openai/gpt-oss-120b',
}));

export default defineWorkflow({
  agent,
  input: v.object({
    scope: v.optional(v.string()),
  }),

  async run({ harness, input, log }) {
    log.info('Running lead scoring batch');

    const scope = input.scope || 'system';
    const leads = await listMatters({ table: 'matter', scope, type: 'lead' });

    const scoredLeads = leads.rows.map((lead: any) => ({
      id: lead.id,
      title: lead.title,
      score: Math.floor(Math.random() * 100),
    }));

    const hot = scoredLeads.filter((l: any) => l.score >= 70).length;
    const warm = scoredLeads.filter((l: any) => l.score >= 40 && l.score < 70).length;
    const cold = scoredLeads.filter((l: any) => l.score < 40).length;

    log.info(`Scored ${scoredLeads.length} leads: ${hot} hot, ${warm} warm, ${cold} cold`);
    return { total: scoredLeads.length, hot, warm, cold };
  },
});
