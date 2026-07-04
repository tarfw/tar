/**
 * KV cache helper for hot reads (product catalog, workspace config).
 */

export async function cachedRead<T>(
  env: { STOREFRONT_CACHE: KVNamespace },
  key: string,
  fetcher: () => Promise<T>,
  ttl = 300
): Promise<T> {
  const cached = await env.STOREFRONT_CACHE.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch { return cached as unknown as T; }
  }
  const fresh = await fetcher();
  await env.STOREFRONT_CACHE.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
  return fresh;
}

export async function cacheInvalidate(
  env: { STOREFRONT_CACHE: KVNamespace },
  key: string
): Promise<void> {
  await env.STOREFRONT_CACHE.delete(key);
}
