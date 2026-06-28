import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { getMatter, setAttr, storeMemory } from '@/lib/helpers';

export const actionScore = defineAction({
  name: 'action_score',
  description: 'Use LLM to evaluate a matter and write the score to attr + memory.',
  input: v.object({
    matterId: v.string(),
    scope: v.string(),
    criteria: v.optional(v.string()),
  }),
  output: v.object({ matterId: v.string(), score: v.number() }),
  async run({ harness, input, log }) {
    log.info(`Scoring matter ${input.matterId}`);

    const matterResult = await getMatter({
      table: 'matter',
      scope: input.scope,
      id: input.matterId,
    });

    const matter = matterResult.rows[0];
    if (!matter) throw new Error(`Matter not found: ${input.matterId}`);

    const matterData = typeof matter.data === 'string' ? JSON.parse(matter.data) : matter.data || {};
    const description = `${matter.title || matter.type}: ${JSON.stringify(matterData)}`;
    const criteriaText = input.criteria || 'overall quality and priority';

    const session = await harness.session();
    const response = await session.prompt(
      `Score this item on a scale of 0-100 based on "${criteriaText}":\n\n${description}\n\nRespond with ONLY a number.`
    );

    const scoreMatch = response.text.match(/\d+/);
    const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[0]))) : 50;

    await setAttr({
      matterId: input.matterId,
      key: 'score',
      num: score,
      scope: input.scope,
    });

    await storeMemory({
      id: input.matterId,
      matter: input.matterId,
      text: `${matter.title} scored ${score}/100 based on ${criteriaText}`,
      embedding: '',
      meta: { table: 'matter', scope: input.scope, type: matter.type, score },
      scope: input.scope,
    });

    return { matterId: input.matterId, score };
  },
});
