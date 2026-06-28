import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import { toolListMatters } from '@/tools/core/list_matters';
import { actionScore } from '@/actions/core/score';

const agent = defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  tools: [toolListMatters],
  actions: [actionScore],
}));

export default defineWorkflow({
  agent,
  input: v.object({
    scope: v.optional(v.string()),
  }),

  async run({ harness, input, log }) {
    log.info('Running lead scoring batch');

    const scope = input.scope || 'system';

    const leadsResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope,
      type: 'lead',
    });

    const scoredLeads = [];

    for (const lead of leadsResult.rows) {
      const scoreResult = await harness.actions.call(actionScore, {
        matterId: lead.id,
        scope,
        criteria: 'purchase intent, budget, urgency, engagement recency',
      });

      scoredLeads.push({
        id: lead.id,
        title: lead.title,
        score: scoreResult.score,
      });
    }

    scoredLeads.sort((a: any, b: any) => b.score - a.score);

    const hotLeads = scoredLeads.filter((l: any) => l.score >= 70);
    const warmLeads = scoredLeads.filter((l: any) => l.score >= 40 && l.score < 70);
    const coldLeads = scoredLeads.filter((l: any) => l.score < 40);

    log.info(`Scored ${scoredLeads.length} leads: ${hotLeads.length} hot, ${warmLeads.length} warm, ${coldLeads.length} cold`);

    return {
      total: scoredLeads.length,
      hot: hotLeads.length,
      warm: warmLeads.length,
      cold: coldLeads.length,
      leads: scoredLeads,
    };
  },
});
