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
    threshold: v.optional(v.number()),
  }),

  async run({ harness, input, log }) {
    log.info('Running inventory alert check');

    const threshold = input.threshold || 5;
    const scope = input.scope || 'system';

    const products = await listMatters({ table: 'matter', scope, type: 'product' });
    const lowStock = products.rows.filter((p: any) => {
      const stock = p.data?.stock || 0;
      return stock < threshold;
    });

    log.info(`Found ${lowStock.length} low-stock products`);
    return { lowStockCount: lowStock.length, threshold, products: lowStock };
  },
});
