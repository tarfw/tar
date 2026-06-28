import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { toolAppendMotion } from '@/tools/core/append_motion';

export const actionAddToCart = defineAction({
  name: 'action_add_to_cart',
  description: 'Add an item to the shopping cart (motion stream).',
  input: v.object({
    sessionId: v.string(),
    productName: v.string(),
    price: v.number(),
    qty: v.number(),
    scope: v.string(),
  }),
  output: v.object({ added: v.boolean() }),
  async run({ harness, input, log }) {
    log.info(`Adding ${input.productName} to cart`);

    await harness.tools.call(toolAppendMotion, {
      stream: `cart_${input.sessionId}`, action: 99993,
      data: { event: 'add_to_cart', product: input.productName, price: input.price, qty: input.qty },
      scope: input.scope,
    });

    return { added: true };
  },
});
