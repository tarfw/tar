import { appendMotion } from '@/lib/helpers';

/**
 * Add an item to the shopping cart (motion stream).
 * @param input - Cart add details
 * @param input.sessionId - Shopping session identifier
 * @param input.productName - Product name
 * @param input.price - Unit price
 * @param input.qty - Quantity
 * @param input.scope - Tenant scope
 * @returns Whether item was added
 */
export async function actionAddToCart(input: {
  sessionId: string;
  productName: string;
  price: number;
  qty: number;
  scope: string;
}): Promise<{ added: boolean }> {
  await appendMotion({
    stream: `cart_${input.sessionId}`, action: 99993,
    data: { event: 'add_to_cart', product: input.productName, price: input.price, qty: input.qty },
    scope: input.scope,
  });

  return { added: true };
}
