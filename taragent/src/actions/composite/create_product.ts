import { createMatter, setAttr, storeMemory, appendMotion } from '@/lib/helpers';

/**
 * Create a product with price, stock, and embedding for search.
 * @param input - Product details
 * @param input.name - Product name (required, non-empty)
 * @param input.price - Unit price
 * @param input.stock - Initial stock (optional)
 * @param input.description - Product description (optional)
 * @param input.storeId - Store identifier
 * @param input.scope - Tenant scope
 * @returns Product matter ID
 */
export async function actionCreateProduct(input: {
  name: string;
  price: number;
  stock?: number;
  description?: string;
  storeId: string;
  scope: string;
}): Promise<{ productId: string }> {
  const productId = `product_${Date.now()}`;
  await createMatter({
    table: 'matter', scope: input.scope, type: 'product',
    title: input.name, value: input.price,
    data: { description: input.description, storeId: input.storeId },
  });

  await setAttr({ matterId: productId, key: 'price', num: input.price, scope: input.scope });
  if (input.stock !== undefined) {
    await setAttr({
      matterId: productId, key: `stock-${input.storeId}`, num: input.stock, scope: input.scope,
    });
  }

  await storeMemory({
    id: productId, matter: productId,
    text: `${input.name}: ${input.description || ''} priced at ${input.price}`,
    embedding: '', meta: { table: 'matter', scope: input.scope, type: 'product' },
    scope: input.scope,
  });

  await appendMotion({
    stream: productId, action: 99993,
    data: { event: 'product_created', name: input.name, price: input.price, stock: input.stock },
    scope: input.scope,
  });

  return { productId };
}
