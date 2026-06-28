import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolCreateMatter } from '@/tools/core/create_matter';
import { toolSetAttr } from '@/tools/core/set_attr';
import { toolStoreMemory } from '@/tools/core/store_memory';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionCreateProduct = defineAction({
  name: 'action_create_product',
  description: 'Create a product with price, stock, and embedding for search.',
  input: v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    price: v.number(),
    stock: v.optional(v.number()),
    description: v.optional(v.string()),
    storeId: v.string(),
    scope: v.string(),
  }),
  output: v.object({ productId: v.string() }),
  async run({ harness, input, log }) {
    log.info(`Creating product: ${input.name}`);

    const productId = `product_${Date.now()}`;
    await harness.tools.call(toolCreateMatter, {
      table: 'matter', scope: input.scope, type: 'product',
      title: input.name, value: input.price,
      data: { description: input.description, storeId: input.storeId },
    });

    await harness.tools.call(toolSetAttr, { matterId: productId, key: 'price', num: input.price, scope: input.scope });
    if (input.stock !== undefined) {
      await harness.tools.call(toolSetAttr, {
        matterId: productId, key: `stock-${input.storeId}`, num: input.stock, scope: input.scope,
      });
    }

    await harness.tools.call(toolStoreMemory, {
      id: productId, matter: productId,
      text: `${input.name}: ${input.description || ''} priced at ${input.price}`,
      embedding: '', meta: { table: 'matter', scope: input.scope, type: 'product' },
      scope: input.scope,
    });

    await harness.tools.call(toolAppendMotion, {
      stream: productId, action: 99993,
      data: { event: 'product_created', name: input.name, price: input.price, stock: input.stock },
      scope: input.scope,
    });

    return { productId };
  },
});
