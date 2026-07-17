import { getPreparedDbForScope, withTransaction } from './db';
import {
  getCallerId,
  requireOwner,
  requireCanRead,
  requireCanCreate,
  requireCanUpdate,
  requireCanDelete,
} from './acl';
import { forwardToCloud } from './remote';
import { parseGeo, encodeGeo, haversineKm, parseRadius } from './geo';
import type { Database } from '@tursodatabase/sync-react-native';

// ============================================================
// ULID Generator (Crockford's Base32)
// ============================================================
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = 32;

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = "";
  for (let i = 0; i < len; i++) {
    const rand = Math.floor(Math.random() * ENCODING_LEN);
    str += ENCODING.charAt(rand);
  }
  return str;
}

export function generateUlid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

export function generateEntityId(type: string): string {
  const prefixMap: Record<string, string> = {
    product: 'prd', order: 'ord', booking: 'bkg', customer: 'cus',
    staff: 'stf', invoice: 'inv', expense: 'exp', deal: 'dea',
    contract: 'ctr', asset: 'ast', ticket: 'tkt', project: 'prj',
    payslip: 'pay', purchase: 'pur', workorder: 'woe', shipment: 'shp',
    listing: 'lst', setting: 'set', motion: 'mot', inbox: 'ibx'
  };
  const prefix = prefixMap[type] || type.slice(0, 3).toLowerCase();
  return `${prefix}${generateUlid()}`;
}

function parseJson(value: any): any {
  if (!value) return {};
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;

  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

async function checkClientRefIdempotent(
  db: Database,
  stream: string,
  clientRef: string | undefined
): Promise<any | null> {
  if (!clientRef) return null;
  // Check if a motion with this client_ref already exists
  const motion = await db.get(
    'SELECT ref FROM motion WHERE ref = ? AND data LIKE ? ORDER BY at DESC LIMIT 1',
    [stream, `%${clientRef}%`]
  ).catch(() => null);
  if (!motion) return null;
  const record = await db.get(
    'SELECT * FROM matter WHERE id = ?',
    [stream]
  ).catch(() => null);
  return record || null;
}

/**
 * Tool 1: create
 * Inserts a matter, motion, graph, or inbox record.
 */
export async function create(opts: {
  table: 'matter' | 'motion' | 'graph' | 'inbox';
  scope: string;
  type: string;
  id?: string;
  title?: string;
  value?: number;
  status?: string;
  data?: any;
  file?: string;
  ref?: string;
  by?: string;
  src?: string;
  rel?: string;
  tgt?: string;
  due?: number;
  at?: number;
  links?: { src: string; rel: string; tgt: string }[];
  motion?: { action: number; phase?: number; delta?: number };
  client_ref?: string;
}) {
  const cloudResult = await forwardToCloud<{ id: string; status: string }>(opts.scope, 'create', opts);
  if (cloudResult) return cloudResult;

  const db = await getPreparedDbForScope(opts.scope);
  const nowUnix = Math.floor(Date.now() / 1000);
  const callerId = getCallerId();

  // Enforce create ACL
  await requireCanCreate(opts.scope);

  if (opts.table === 'matter') {
    const id = opts.id || generateEntityId(opts.type || 'product');

    // Idempotency check
    if (opts.client_ref) {
      const existing = await checkClientRefIdempotent(db, id, opts.client_ref);
      if (existing) {
        return { id: existing.id, status: 'created' };
      }
    }

    const mergedData = { ...(opts.data || {}) };
    if (opts.title && !mergedData.title) {
      mergedData.title = opts.title;
    }

    await withTransaction(db, async () => {
      await db.run(
        `INSERT INTO matter (id, type, title, value, status, data, file, scope, at, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          opts.type || 'product',
          opts.title || 'Untitled',
          opts.value ?? null,
          opts.status || 'active',
          JSON.stringify(mergedData),
          opts.file || null,
          opts.scope,
          opts.at || nowUnix,
          nowUnix
        ]
      );

      // Log motion event for matter creation
      await db.run(
        `INSERT INTO motion (id, type, ref, data, by, at, scope)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateEntityId('motion'),
          'change',
          id,
          JSON.stringify({ event: 'created', client_ref: opts.client_ref || null }),
          callerId || 'system',
          nowUnix,
          opts.scope
        ]
      );

      // Handle graph links if provided
      if (opts.links && opts.links.length > 0) {
        for (const link of opts.links) {
          const src = link.src === '$id' ? id : link.src;
          const tgt = link.tgt === '$id' ? id : link.tgt;
          await db.run(
            `INSERT OR REPLACE INTO graph (src, rel, tgt, scope, time)
             VALUES (?, ?, ?, ?, ?)`,
            [src, link.rel, tgt, opts.scope, nowUnix]
          );
        }
      }
    });

    return { id, status: 'created' };
  }

  if (opts.table === 'motion') {
    const id = opts.id || generateEntityId('motion');
    await db.run(
      `INSERT INTO motion (id, type, ref, data, by, at, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        opts.type || 'activity',
        opts.ref || null,
        JSON.stringify(opts.data || {}),
        opts.by || callerId || 'system',
        opts.at || nowUnix,
        opts.scope
      ]
    );
    return { id, status: 'created' };
  }

  if (opts.table === 'graph') {
    if (!opts.src || !opts.rel || !opts.tgt) {
      throw new Error('src, rel, tgt required for graph creation');
    }
    await db.run(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, scope, time)
       VALUES (?, ?, ?, ?, ?)`,
      [opts.src, opts.rel, opts.tgt, opts.scope, opts.at || nowUnix]
    );
    return { src: opts.src, rel: opts.rel, tgt: opts.tgt, status: 'linked' };
  }

  if (opts.table === 'inbox') {
    const id = opts.id || generateEntityId('inbox');
    await db.run(
      `INSERT INTO inbox (id, scope, type, title, status, ref, data, due, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        opts.scope,
        opts.type || 'task',
        opts.title || 'Notification',
        opts.status || 'open',
        opts.ref || null,
        JSON.stringify(opts.data || {}),
        opts.due || null,
        opts.at || nowUnix
      ]
    );
    return { id, status: 'created' };
  }

  throw new Error(`Creation not supported for table: ${opts.table}`);
}

/**
 * Tool 2: read
 * Queries database records with safety filters, joins, graph traversal, and projection.
 */
export async function read(opts: {
  table: 'matter' | 'motion' | 'graph' | 'inbox';
  scope: string;
  id?: string;
  type?: string;
  ref?: string;
  status?: string;
  fields?: string[];
  filters?: { key: string; val: any }[];
  joins?: { table: 'graph'; on: string; as: string }[];
  graph_filter?: { src?: string; rel?: string; tgt?: string };
  depth?: number;
  order?: string;
  limit?: number;
  offset?: number;
}) {
  const cloudResult = await forwardToCloud<{ rows: any[]; count: number; next_offset?: number }>(opts.scope, 'read', opts);
  if (cloudResult) return cloudResult;

  const db = await getPreparedDbForScope(opts.scope);

  // Enforce read ACL
  await requireCanRead(opts.scope);

  // Build projection
  let selectClause = '*';
  if (opts.fields && opts.fields.length > 0 && opts.table !== 'graph' && opts.table !== 'motion') {
    selectClause = opts.fields.map(f => {
      const alias = f.replace(/\./g, '_');
      return `json_extract(data, '$.${f}') AS ${alias}`;
    }).join(', ');
  }

  let query = `SELECT ${selectClause} FROM ${opts.table}`;
  const params: any[] = [];

  // Joins
  if (opts.joins && opts.joins.length > 0) {
    for (const join of opts.joins) {
      const cleanOn = join.on.replace(/[^a-zA-Z0-9_=.\s]/g, '');
      query += ` LEFT JOIN ${join.table} AS ${join.as} ON ${cleanOn}`;
    }
  }

  query += ' WHERE 1=1';

  if (opts.table !== 'graph') {
    query += ' AND scope = ?';
    params.push(opts.scope);
  }

  if (opts.id) {
    query += ' AND id = ?';
    params.push(opts.id);
  }

  if (opts.type) {
    query += ' AND type = ?';
    params.push(opts.type);
  }

  if (opts.ref) {
    query += ' AND ref = ?';
    params.push(opts.ref);
  }

  if (opts.status) {
    query += ' AND status = ?';
    params.push(opts.status);
  }

  if (opts.filters && opts.filters.length > 0 && (opts.table === 'matter' || opts.table === 'inbox')) {
    for (const filter of opts.filters) {
      query += ' AND json_extract(data, ?) = ?';
      params.push(`$.${filter.key}`, filter.val);
    }
  }

  if (opts.graph_filter) {
    const gf = opts.graph_filter;
    query += ' AND (';
    const parts: string[] = [];
    if (gf.src) { parts.push('src = ?'); params.push(gf.src); }
    if (gf.rel) { parts.push('rel = ?'); params.push(gf.rel); }
    if (gf.tgt) { parts.push('tgt = ?'); params.push(gf.tgt); }
    query += parts.join(' AND ') + ')';
  }

  // Graph depth traversal
  if (opts.depth && opts.depth > 0 && (opts.graph_filter?.src || opts.graph_filter?.tgt)) {
    const maxDepth = Math.min(opts.depth, 3);
    const root = opts.graph_filter.src || opts.graph_filter.tgt;
    const direction = opts.graph_filter.src ? 'src' : 'tgt';
    const other = direction === 'src' ? 'tgt' : 'src';
    query = `
      WITH RECURSIVE traversal(${direction}, rel, ${other}, depth) AS (
        SELECT ${direction}, rel, ${other}, 1 FROM graph
        WHERE ${direction} = ?
        UNION ALL
        SELECT g.${direction}, g.rel, g.${other}, t.depth + 1
        FROM graph g
        JOIN traversal t ON g.${direction} = t.${other}
        WHERE t.depth < ?
      )
      SELECT ${selectClause} FROM ${opts.table}
      WHERE id IN (SELECT ${other} FROM traversal)
    `;
    params.unshift(root, maxDepth);
  }

  // Count query
  let countQuery = query.replace(/SELECT\s+.+?\s+FROM\s+/i, 'SELECT COUNT(*) AS c FROM ');
  countQuery = countQuery.replace(/\s+ORDER\s+BY\s+.+$/i, '');
  countQuery = countQuery.replace(/\s+LIMIT\s+\d+\s+OFFSET\s+\d+$/i, '');
  const countRes = await db.get(countQuery, params).catch(() => ({ c: 0 }));
  const count = Number(countRes?.c ?? 0);

  if (opts.order) {
    const cleanOrder = opts.order.replace(/[^a-zA-Z0-9_\s]/g, '');
    query += ` ORDER BY ${cleanOrder}`;
  } else if (opts.table === 'motion') {
    query += ' ORDER BY at DESC';
  } else if (opts.table === 'matter') {
    query += ' ORDER BY updated DESC';
  } else if (opts.table === 'inbox') {
    query += ' ORDER BY at DESC';
  }

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.all(query, params).catch(() => []);

  const parsedRows = rows.map((row: any) => {
    const copy = { ...row };
    if (copy.data) {
      try {
        copy.data = JSON.parse(copy.data);
      } catch {}
    }
    return copy;
  });

  const result: { rows: any[]; count: number; next_offset?: number } = {
    rows: parsedRows,
    count
  };
  if (offset + parsedRows.length < count) {
    result.next_offset = offset + parsedRows.length;
  }
  return result;
}

/**
 * Tool 3: update
 * Updates matter or inbox properties, merges data column.
 */
export async function update(opts: {
  table: 'matter' | 'inbox';
  id: string;
  scope: string;
  patch: {
    title?: string;
    value?: number;
    status?: string;
    data?: any;
    file?: string;
    due?: number;
  };
  client_ref?: string;
}) {
  const cloudResult = await forwardToCloud<{ success: boolean; id?: string }>(opts.scope, 'update', opts);
  if (cloudResult) return cloudResult;

  const db = await getPreparedDbForScope(opts.scope);
  const nowUnix = Math.floor(Date.now() / 1000);

  const existing = await db.get(`SELECT * FROM ${opts.table} WHERE id = ? AND scope = ?`, [opts.id, opts.scope]).catch(() => null);
  if (!existing) {
    return { success: false, reason: 'record_not_found' };
  }

  const owner = existing.data ? parseJson(existing.data).owner : null;
  // Check ACL
  await requireCanUpdate(opts.scope, owner);

  // Idempotency check
  if (opts.client_ref) {
    const existingMotion = await db.get(
      'SELECT id FROM motion WHERE ref = ? AND data LIKE ? ORDER BY at DESC LIMIT 1',
      [opts.id, `%${opts.client_ref}%`]
    ).catch(() => null);
    if (existingMotion) {
      return { success: true, id: opts.id };
    }
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (opts.patch.title !== undefined) {
    sets.push('title = ?');
    params.push(opts.patch.title);
  }
  if (opts.patch.value !== undefined && opts.table === 'matter') {
    sets.push('value = ?');
    params.push(opts.patch.value);
  }
  if (opts.patch.status !== undefined) {
    sets.push('status = ?');
    params.push(opts.patch.status);
  }
  if (opts.patch.file !== undefined && opts.table === 'matter') {
    sets.push('file = ?');
    params.push(opts.patch.file);
  }
  if (opts.patch.due !== undefined && opts.table === 'inbox') {
    sets.push('due = ?');
    params.push(opts.patch.due);
  }

  let mergedData = parseJson(existing.data);
  if (opts.patch.data !== undefined) {
    mergedData = deepMerge(mergedData, opts.patch.data);
  }
  if (opts.patch.title !== undefined) {
    mergedData.title = opts.patch.title;
  }

  sets.push('data = ?');
  params.push(JSON.stringify(mergedData));

  if (opts.table === 'matter') {
    sets.push('updated = ?');
    params.push(nowUnix);
  }

  params.push(opts.id, opts.scope);

  await withTransaction(db, async () => {
    await db.run(
      `UPDATE ${opts.table} SET ${sets.join(', ')} WHERE id = ? AND scope = ?`,
      params
    );

    // If updating matter, log to motion
    if (opts.table === 'matter') {
      await db.run(
        `INSERT INTO motion (id, type, ref, data, by, at, scope)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateEntityId('motion'),
          'change',
          opts.id,
          JSON.stringify({ event: 'updated', changed: Object.keys(opts.patch), client_ref: opts.client_ref || null }),
          getCallerId() || 'system',
          nowUnix,
          opts.scope
        ]
      );
    }
  });

  return { success: true, id: opts.id };
}

/**
 * Tool 4: delete (aliased to del)
 * Soft-deactivates records (marks matter or inbox archived) or physically deletes graph edges.
 */
export async function del(opts: {
  table: 'matter' | 'graph' | 'inbox';
  id: string;
  scope: string;
  hard?: boolean;
  cascade?: boolean;
  client_ref?: string;
}) {
  const cloudResult = await forwardToCloud<{ id: string }>(opts.scope, 'delete', opts);
  if (cloudResult) return cloudResult;

  const db = await getPreparedDbForScope(opts.scope);
  const nowUnix = Math.floor(Date.now() / 1000);

  let owner: string | null = null;
  if (opts.table !== 'graph') {
    const existing = await db.get(`SELECT data FROM ${opts.table} WHERE id = ? AND scope = ?`, [opts.id, opts.scope]).catch(() => null);
    if (existing && existing.data) {
      owner = parseJson(existing.data).owner || null;
    }
  }

  // Enforce delete ACL
  await requireCanDelete(opts.scope, owner);

  if (opts.table === 'graph') {
    await db.run('DELETE FROM graph WHERE (src = ? OR tgt = ?) AND scope = ?', [opts.id, opts.id, opts.scope]);
    return { id: opts.id, mode: 'hard' };
  }

  await withTransaction(db, async () => {
    if (opts.table === 'matter') {
      await db.run(`UPDATE matter SET status = 'archived', updated = ? WHERE id = ? AND scope = ?`, [nowUnix, opts.id, opts.scope]);
      // Log deletion event to motion
      await db.run(
        `INSERT INTO motion (id, type, ref, data, by, at, scope)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateEntityId('motion'),
          'change',
          opts.id,
          JSON.stringify({ event: 'deleted', client_ref: opts.client_ref || null }),
          getCallerId() || 'system',
          nowUnix,
          opts.scope
        ]
      );
    } else if (opts.table === 'inbox') {
      await db.run(`UPDATE inbox SET status = 'archived' WHERE id = ? AND scope = ?`, [opts.id, opts.scope]);
    }

    if (opts.cascade !== false) {
      await db.run('DELETE FROM graph WHERE (src = ? OR tgt = ?) AND scope = ?', [opts.id, opts.id, opts.scope]);
    }
  });

  return { id: opts.id, mode: 'soft' };
}

/**
 * Tool 5: link
 * Connects two entity nodes via graph edges.
 */
export async function link(opts: {
  src: string;
  rel: string;
  tgt: string;
  bidirectional?: boolean;
  active?: boolean;
  scope: string;
  client_ref?: string;
}) {
  const cloudResult = await forwardToCloud<{ src: string; rel: string; tgt: string; status: string }>(opts.scope, 'link', opts);
  if (cloudResult) return cloudResult;

  const db = await getPreparedDbForScope(opts.scope);
  const nowUnix = Math.floor(Date.now() / 1000);
  const active = opts.active !== false;

  await requireCanCreate(opts.scope);

  if (!active) {
    await db.run(
      'DELETE FROM graph WHERE src = ? AND rel = ? AND tgt = ? AND scope = ?',
      [opts.src, opts.rel, opts.tgt, opts.scope]
    );
    if (opts.bidirectional) {
      await db.run(
        'DELETE FROM graph WHERE src = ? AND rel = ? AND tgt = ? AND scope = ?',
        [opts.tgt, opts.rel, opts.src, opts.scope]
      );
    }
    return { src: opts.src, rel: opts.rel, tgt: opts.tgt, status: 'unlinked' };
  }

  await withTransaction(db, async () => {
    await db.run(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, scope, time)
       VALUES (?, ?, ?, ?, ?)`,
      [opts.src, opts.rel, opts.tgt, opts.scope, nowUnix]
    );

    if (opts.bidirectional) {
      await db.run(
        `INSERT OR REPLACE INTO graph (src, rel, tgt, scope, time)
         VALUES (?, ?, ?, ?, ?)`,
        [opts.tgt, opts.rel, opts.src, opts.scope, nowUnix]
      );
    }
  });

  return { src: opts.src, rel: opts.rel, tgt: opts.tgt, status: 'linked' };
}

/**
 * Tool 6: search
 * Queries matter table using SQL filters and LIKE query fallback since memory table is removed.
 */
export async function search(opts: {
  query: string;
  scope: string;
  type?: string;
  table?: 'matter';
  mode?: 'structured' | 'fts' | 'geo';
  geo?: { center: string; radius?: string | number };
  filters?: { key: string; val: any }[];
  limit?: number;
  threshold?: number;
}) {
  const cloudResult = await forwardToCloud<any[]>(opts.scope, 'search', opts);
  if (cloudResult) return cloudResult;

  const limit = opts.limit ?? 10;
  const db = await getPreparedDbForScope(opts.scope);

  if (opts.mode === 'geo' && opts.geo?.center) {
    const center = parseGeo(opts.geo.center);
    if (!center) throw new Error('Invalid geo center format');
    const radiusKm = parseRadius(opts.geo.radius ?? 5);

    let sql = `SELECT * FROM matter WHERE scope = ? AND status = 'active' AND data LIKE ?`;
    const params: any[] = [opts.scope, '%geo%'];

    if (opts.type) {
      sql += ' AND type = ?';
      params.push(opts.type);
    }

    const rows = await db.all(sql, params).catch(() => []);
    const scored = rows
      .map((r: any) => {
        const data = parseJson(r.data);
        const point = data.geo ? parseGeo(data.geo) : null;
        if (!point) return null;
        const distanceKm = haversineKm(center, point);
        return {
          id: r.id,
          text: r.title,
          meta: { table: 'matter', scope: r.scope, type: r.type, title: r.title, geo: data.geo },
          similarity: Math.max(0, 1 - distanceKm / radiusKm),
          source: 'geo',
          distanceKm
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return scored;
  }

  // Standard structured or text search over matter titles / data using LIKE
  let sql = `SELECT * FROM matter WHERE scope = ? AND status = 'active'`;
  const params: any[] = [opts.scope];

  if (opts.type) {
    sql += ' AND type = ?';
    params.push(opts.type);
  }

  if (opts.query) {
    const words = opts.query.toLowerCase().split(/\s+/).filter(w => w.trim());
    if (words.length > 0) {
      sql += ' AND (';
      sql += words.map(() => '(LOWER(title) LIKE ? OR LOWER(data) LIKE ?)').join(' AND ');
      sql += ')';
      words.forEach(w => {
        params.push(`%${w}%`, `%${w}%`);
      });
    }
  }

  if (opts.filters && opts.filters.length > 0) {
    for (const filter of opts.filters) {
      sql += ' AND json_extract(data, ?) = ?';
      params.push(`$.${filter.key}`, filter.val);
    }
  }

  sql += ' ORDER BY updated DESC LIMIT ?';
  params.push(limit);

  const rows = await db.all(sql, params).catch(() => []);
  return rows.map((r: any) => {
    const data = parseJson(r.data);
    return {
      id: r.id,
      text: r.title,
      meta: { table: 'matter', scope: r.scope, type: r.type, title: r.title },
      similarity: 1.0,
      source: 'structured'
    };
  });
}
