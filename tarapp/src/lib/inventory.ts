import { tar } from './tar';
import { routeDbForEntity } from './db';

/**
 * Helper to find a product row by id or title in local DB or via tar.tool.
 * Local-first: returns in 1ms without blocking on network requests if local match exists.
 */
export async function findProduct(scope: string, identifier: string) {
  if (!identifier) return null;

  // 1. Try local SQLite DB first (instant local-first search by id, title, or lower(title))
  try {
    const db = routeDbForEntity('product', scope);
    const rows = await db.all(
      `SELECT * FROM matter WHERE id = ? OR title = ? OR lower(title) = lower(?) LIMIT 1`,
      [identifier, identifier, identifier]
    );
    if (rows && rows.length > 0) {
      console.log(`[findProduct] ⚡ Instant local SQLite match for "${identifier}": id=${rows[0].id}, title="${rows[0].title}"`);
      return rows[0];
    }
  } catch (err) {
    console.warn('[findProduct] Local DB query warning:', err);
  }

  // 2. Network fallback only if not found locally
  console.log(`[findProduct] 🌐 Local match not found, running network search for "${identifier}"...`);
  try {
    const readRes = await tar.tool('read', { table: 'matter', id: identifier, scope }).catch(() => null);
    if (readRes?.row) return readRes.row;
    
    const searchRes = await tar.tool('search', { table: 'matter', query: identifier, scope }).catch(() => null);
    if (searchRes?.rows?.length > 0) return searchRes.rows[0];
    if (searchRes?.results?.length > 0) return searchRes.results[0];
  } catch (err) {
    console.warn('[findProduct] tar.tool findProduct warning:', err);
  }

  return null;
}

export interface StockUpdateOptions {
  fromLoc?: string;
  toLoc?: string;
  isInternal?: boolean;
  refId?: string;
}

/**
 * Update stock level for a product atomically, update location breakdown, log motion, and check low stock threshold.
 */
export async function updateStock(
  scope: string,
  productId: string,
  delta: number,
  motionType: string,
  reason?: string,
  options?: StockUpdateOptions
): Promise<number> {
  console.log(`[updateStock] 🚀 START — scope: "${scope}", target: "${productId}", delta: ${delta}, type: "${motionType}"`);

  if (!scope || !productId) {
    console.warn('[updateStock] ⚠️ ABORT — missing scope or productId');
    return 0;
  }

  const product = await findProduct(scope, productId);
  if (!product) {
    console.error(`[updateStock] ❌ ERROR — Product not found in matter table for scope "${scope}" with identifier "${productId}"`);
    return 0;
  }

  const actualId = product.id;
  const currentQty = Number(product.value ?? 0);
  
  // If internal transfer within same workspace, global ON HAND value is unchanged (delta = 0 for value)
  const isInternalTransfer = options?.isInternal || false;
  const netValueDelta = isInternalTransfer ? 0 : delta;
  const newQty = Math.max(0, currentQty + netValueDelta);

  const primitiveData = typeof product.data === 'string' ? (JSON.parse(product.data) || {}) : (product.data || {});
  const minQty = Number(primitiveData?.min ?? 0);
  const unit = primitiveData?.unit || 'pcs';
  const title = product.title || 'Product';

  // Update locations map inside primitiveData
  const locations: Record<string, number> = primitiveData.locations || {};
  const transferQty = Math.abs(delta);

  if (options?.fromLoc) {
    const currentFromQty = locations[options.fromLoc] ?? Math.max(0, currentQty);
    locations[options.fromLoc] = Math.max(0, currentFromQty - transferQty);
  }
  if (options?.toLoc) {
    const currentToQty = locations[options.toLoc] ?? 0;
    locations[options.toLoc] = currentToQty + transferQty;
  }

  primitiveData.locations = locations;
  const updatedDataStr = JSON.stringify(primitiveData);

  console.log(`[updateStock] 📦 Product matched: "${title}" (id: ${actualId}). Current ON HAND: ${currentQty} ${unit} -> New ON HAND: ${newQty} ${unit}.`);

  // 1. Update matter value & data locally in SQLite DB (Instant 1ms)
  try {
    const db = routeDbForEntity('product', scope);
    await db.run(
      `UPDATE matter SET value = ?, data = ?, updated = unixepoch() WHERE id = ?`,
      [newQty, updatedDataStr, actualId]
    );
    console.log(`[updateStock] ⚡ Local SQLite value updated to ${newQty} for id: ${actualId}`);
  } catch (dbErr) {
    console.warn('[updateStock] Local DB update warning:', dbErr);
  }

  // Non-blocking background network sync
  tar.tool('update', {
    table: 'matter',
    id: actualId,
    scope,
    type: product.type || 'product',
    patch: { value: newQty, data: primitiveData },
  }).catch((tarErr) => console.warn('[updateStock] Non-blocking tar.tool update note:', tarErr));

  // 2. Log motion entry in SQLite (Instant 1ms)
  const motionId = `mot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const motionData = {
    delta: netValueDelta,
    transferQty: isInternalTransfer ? transferQty : undefined,
    newQty,
    previousQty: currentQty,
    reason: reason || motionType,
    fromLoc: options?.fromLoc || null,
    toLoc: options?.toLoc || null,
    refId: options?.refId || null,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = routeDbForEntity('product', scope);
    await db.run(
      `INSERT INTO motion (id, type, ref, data, scope, at) VALUES (?, ?, ?, ?, ?, unixepoch())`,
      [motionId, motionType, actualId, JSON.stringify(motionData), scope]
    );
    console.log(`[updateStock] ⚡ Local motion logged: id=${motionId}, type=${motionType}, ref=${actualId}`);
  } catch (dbErr) {
    console.warn('[updateStock] Local motion log warning:', dbErr);
  }

  // Non-blocking background motion network sync
  tar.tool('create', {
    table: 'motion',
    type: motionType,
    ref: actualId,
    data: motionData,
    scope,
  }).catch((tarErr) => console.warn('[updateStock] Non-blocking tar.tool motion creation note:', tarErr));

  // 3. Check low stock threshold
  if (netValueDelta < 0 && newQty <= minQty && minQty > 0) {
    console.log(`[updateStock] 🔔 LOW STOCK TRIGGERED — newQty (${newQty}) <= minQty (${minQty})`);
    tar.tool('create', {
      table: 'inbox',
      type: 'stock',
      title: `Low stock: ${title} (${newQty} ${unit} left)`,
      status: 'open',
      ref: actualId,
      data: { productId: actualId, qty: newQty, min: minQty },
      scope,
    }).catch((e) => console.warn('[updateStock] Low stock alert creation error:', e));
  }

  console.log(`[updateStock] 🎉 SUCCESS (INSTANT) — Stock updated to ${newQty} ${unit} for "${title}"`);
  return newQty;
}

/**
 * Fetch motion stock history for a specific product.
 */
export async function getStockHistory(scope: string, productId: string): Promise<any[]> {
  console.log(`[getStockHistory] 🔍 Fetching history for scope: "${scope}", target: "${productId}"`);
  if (!scope || !productId) return [];

  const product = await findProduct(scope, productId);
  const actualId = product ? product.id : productId;

  let historyRows: any[] = [];
  try {
    const db = routeDbForEntity('product', scope);
    const rows = await db.all(
      `SELECT * FROM motion WHERE ref = ? OR ref = ? ORDER BY at DESC`,
      [actualId, productId]
    );
    if (rows && rows.length > 0) {
      historyRows = rows;
    }
  } catch (err) {
    console.warn('[getStockHistory] Local DB fetch warning:', err);
  }

  if (historyRows.length === 0) {
    try {
      const res = await tar.tool('read', { table: 'motion', ref: actualId, scope });
      const rawList = Array.isArray(res?.rows) ? res.rows : res?.row ? [res.row] : [];
      historyRows = rawList.filter((r: any) => Boolean(r));
    } catch (err) {
      console.warn('[getStockHistory] tar.tool fetch warning:', err);
    }
  }

  console.log(`[getStockHistory] ✅ Found ${historyRows.length} history records for "${productId}"`);
  return historyRows.sort((a: any, b: any) => (b.at || b.timestamp || 0) - (a.at || a.timestamp || 0));
}
