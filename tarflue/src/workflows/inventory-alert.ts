import { defineAgent, defineWorkflow } from '@flue/runtime';
import * as v from 'valibot';
import { toolListMatters } from '@/tools/core/list_matters';
import { toolReadMotions } from '@/tools/core/read_motions';
import { actionNotify } from '@/actions/core/notify';

const agent = defineAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  tools: [toolListMatters, toolReadMotions],
  actions: [actionNotify],
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

    const productsResult = await harness.tools.call(toolListMatters, {
      table: 'matter',
      scope,
      type: 'product',
    });

    const lowStockItems: string[] = [];

    for (const product of productsResult.rows) {
      const stockKey = `stock-${scope}`;
      const stock = product.data?.[stockKey] ?? 0;

      if (stock < threshold) {
        lowStockItems.push(`${product.title}: ${stock} units remaining`);
      }
    }

    if (lowStockItems.length > 0) {
      const message = `Low stock alert:\n${lowStockItems.join('\n')}`;

      await harness.actions.call(actionNotify, {
        to: 'inventory-manager',
        channel: 'email',
        template: 'low-stock-alert',
        data: { items: lowStockItems, message },
        scope,
      });

      log.info(`Alert sent for ${lowStockItems.length} low-stock items`);
    } else {
      log.info('All products above threshold');
    }

    return { lowStockCount: lowStockItems.length, items: lowStockItems };
  },
});
