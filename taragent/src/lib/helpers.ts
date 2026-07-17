/**
 * Helper database operations for the agents and tools.
 * Aligned with dbrules.md schema.
 */

import { dbGet, dbAll, dbRun, envContext } from './db';

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

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

const RICH_FIELD_KEYS = new Set([
  'description', 'images', 'variants', 'notes', 'address', 'form_answers',
  'attachments', 'line_items', 'history', 'preferences', 'terms', 'bank_details',
  'activity_notes', 'contacts', 'intake_form', 'tags', 'seo'
]);

// ============================================================
// executeCreate — Insert into any table
// ============================================================
export async function executeCreate(input: {
  table: string;
  scope?: string;
  type?: string;
  title?: string;
  value?: number;
  status?: string;
  data?: Record<string, any>;
  file?: string;
  ref?: string;
  by?: string;
  src?: string;
  rel?: string;
  tgt?: string;
  due?: number;
  at?: number;
  [key: string]: any;
}) {
  const scope = input.scope || 'ws:global';
  const nowUnix = Math.floor(Date.now() / 1000);

  if (input.table === 'matter') {
    const id = input.id || generateEntityId(input.type || 'product');
    const type = input.type || 'product';
    const status = input.status || 'active';
    let finalData = input.data || {};
    let finalFile = input.file || null;

    if (input.data) {
      const essentials: Record<string, any> = {};
      const rich: Record<string, any> = {};
      let hasRichData = false;

      for (const [k, v] of Object.entries(input.data)) {
        const isNested = typeof v === 'object' && v !== null;
        const isRichKey = RICH_FIELD_KEYS.has(k.toLowerCase());

        if (isNested || isRichKey) {
          rich[k] = v;
          hasRichData = true;
        } else {
          essentials[k] = v;
        }
      }

      if (hasRichData) {
        try {
          const env = envContext.getStore();
          if (env) {
            const { s3Put } = await import('./s3-client');
            const storageKey = `${scope}/${id}/full.json`;
            await s3Put(env, storageKey, JSON.stringify(rich), 'application/json');
            finalFile = storageKey;
            finalData = essentials;
          }
        } catch (s3Err) {
          console.warn('[helpers] S3 split upload failed during create:', s3Err);
        }
      }
    }

    await dbRun(
      `INSERT INTO matter (id, type, title, value, status, data, file, scope, at, updated) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        type,
        input.title || 'Untitled',
        input.value ?? null,
        status,
        JSON.stringify(finalData),
        finalFile,
        scope,
        input.at || nowUnix,
        nowUnix
      ]
    );
    return { id, at: input.at || nowUnix, status: 'created', file: finalFile };
  }

  if (input.table === 'motion') {
    const id = input.id || generateEntityId('motion');
    await dbRun(
      `INSERT INTO motion (id, type, ref, data, by, at, scope) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.type || 'activity',
        input.ref || null,
        JSON.stringify(input.data || {}),
        input.by || 'system',
        input.at || nowUnix,
        scope
      ]
    );
    return { id, at: input.at || nowUnix, status: 'created' };
  }

  if (input.table === 'graph') {
    if (!input.src || !input.rel || !input.tgt) {
      throw new Error('src, rel, tgt required for graph');
    }
    await dbRun(
      `INSERT OR REPLACE INTO graph (src, rel, tgt, scope, time) 
       VALUES (?, ?, ?, ?, ?)`,
      [input.src, input.rel, input.tgt, scope, input.at || nowUnix]
    );
    return { src: input.src, rel: input.rel, tgt: input.tgt, status: 'linked' };
  }

  if (input.table === 'inbox') {
    const id = input.id || generateEntityId('inbox');
    await dbRun(
      `INSERT INTO inbox (id, scope, type, title, status, ref, data, due, at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        scope,
        input.type || 'task',
        input.title || 'Notification',
        input.status || 'open',
        input.ref || null,
        JSON.stringify(input.data || {}),
        input.due || null,
        input.at || nowUnix
      ]
    );
    return { id, status: 'created' };
  }

  throw new Error(`Unknown or deprecated table for creation: ${input.table}`);
}

// ============================================================
// executeRead — Select from any table
// ============================================================
export async function executeRead(input: {
  table: string;
  id?: string;
  scope?: string;
  type?: string;
  ref?: string;
  src?: string;
  rel?: string;
  tgt?: string;
  status?: string;
  limit?: number;
  offset?: number;
  filters?: Array<{ key: string; val: any }>;
  [key: string]: any;
}) {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  if (input.table === 'graph') {
    let sql = 'SELECT * FROM graph WHERE 1=1';
    const args: any[] = [];
    if (input.src) { sql += ' AND src = ?'; args.push(input.src); }
    if (input.rel) { sql += ' AND rel = ?'; args.push(input.rel); }
    if (input.tgt) { sql += ' AND tgt = ?'; args.push(input.tgt); }
    if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
    sql += ' ORDER BY time DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);
    const rows = await dbAll(sql, args);
    return { rows, count: rows.length };
  }

  if (input.table === 'motion') {
    let sql = 'SELECT * FROM motion WHERE 1=1';
    const args: any[] = [];
    if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
    if (input.type) { sql += ' AND type = ?'; args.push(input.type); }
    if (input.ref) { sql += ' AND ref = ?'; args.push(input.ref); }
    if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
    sql += ' ORDER BY at DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);
    const rows = await dbAll(sql, args);
    return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
  }

  if (input.table === 'inbox') {
    let sql = 'SELECT * FROM inbox WHERE 1=1';
    const args: any[] = [];
    if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
    if (input.type) { sql += ' AND type = ?'; args.push(input.type); }
    if (input.ref) { sql += ' AND ref = ?'; args.push(input.ref); }
    if (input.status) { sql += ' AND status = ?'; args.push(input.status); }
    if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
    sql += ' ORDER BY at DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);
    const rows = await dbAll(sql, args);
    return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
  }

  // Fallback to matter (also mapping legacy 'form' reads to matter type='setting')
  const actualTable = input.table === 'form' ? 'matter' : input.table;
  let sql = `SELECT * FROM ${actualTable} WHERE 1=1`;
  const args: any[] = [];

  if (input.table === 'form') {
    sql += " AND type = 'setting'";
  }

  if (input.id) { sql += ' AND id = ?'; args.push(input.id); }
  if (input.scope) { sql += ' AND scope = ?'; args.push(input.scope); }
  if (input.type && input.table !== 'form') { sql += ' AND type = ?'; args.push(input.type); }
  if (input.status) { sql += ' AND status = ?'; args.push(input.status); }

  if (input.filters) {
    for (const f of input.filters) {
      sql += ` AND json_extract(data, ?) = ?`;
      args.push(`$.${f.key}`, f.val);
    }
  }

  sql += ' ORDER BY updated DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const rows = await dbAll(sql, args);
  return { rows: rows.map(r => ({ ...r, data: parseJson(r.data) })), count: rows.length };
}

// ============================================================
// executeUpdate — Update any table
// ============================================================
export async function executeUpdate(input: {
  table: string;
  id?: string;
  scope?: string;
  type?: string;
  patch: Record<string, any>;
  [key: string]: any;
}) {
  const nowUnix = Math.floor(Date.now() / 1000);
  const actualTable = input.table === 'form' ? 'matter' : input.table;
  const scope = input.scope || 'ws:global';

  let patch = { ...input.patch };
  let finalFile: string | null = null;

  if (actualTable === 'matter' && input.id) {
    const existing = await dbGet(
      `SELECT type, data, file FROM matter WHERE id = ?`,
      [input.id]
    ).catch(() => null);

    if (existing) {
      const existingData = parseJson(existing.data);
      const existingFileKey = existing.file || `${scope}/${input.id}/full.json`;

      let updatedData = { ...existingData };
      let richPatch: Record<string, any> = {};
      let hasRichPatch = false;

      if (patch.data) {
        for (const [k, v] of Object.entries(patch.data)) {
          const isNested = typeof v === 'object' && v !== null;
          const isRichKey = RICH_FIELD_KEYS.has(k.toLowerCase());

          if (isNested || isRichKey) {
            richPatch[k] = v;
            hasRichPatch = true;
          } else {
            updatedData[k] = v;
          }
        }
        delete patch.data;
      }

      for (const [k, v] of Object.entries(patch)) {
        if (k !== 'id' && k !== 'scope' && k !== 'type' && k !== 'table' && k !== 'file' && k !== 'status' && k !== 'title' && k !== 'value') {
          const isNested = typeof v === 'object' && v !== null;
          const isRichKey = RICH_FIELD_KEYS.has(k.toLowerCase());

          if (isNested || isRichKey) {
            richPatch[k] = v;
            hasRichPatch = true;
          } else {
            updatedData[k] = v;
          }
          delete patch[k];
        }
      }

       if (hasRichPatch) {
        try {
          const env = envContext.getStore();
          if (env) {
            const { s3Get, s3Put } = await import('./s3-client');
            const existingS3Text = await s3Get(env, existingFileKey).catch(() => null);
            const existingRich = existingS3Text ? parseJson(existingS3Text) : {};

            const mergedRich = { ...existingRich, ...richPatch };
            await s3Put(env, existingFileKey, JSON.stringify(mergedRich), 'application/json');
            finalFile = existingFileKey;
          }
        } catch (s3Err) {
          console.warn('[helpers] S3 split update failed:', s3Err);
        }
      }

      patch.data = updatedData;
      if (finalFile) {
        patch.file = finalFile;
      }
    }
  }

  const sets: string[] = ['updated = ?'];
  const args: any[] = [nowUnix];

  for (const [key, val] of Object.entries(patch)) {
    if (val !== undefined) {
      if (key === 'data') {
        sets.push('data = ?');
        args.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = ?`);
        args.push(val);
      }
    }
  }

  let whereClause = 'WHERE 1=1';
  if (input.id) { whereClause += ' AND id = ?'; args.push(input.id); }
  if (input.scope) { whereClause += ' AND scope = ?'; args.push(input.scope); }
  if (input.type) { whereClause += ' AND type = ?'; args.push(input.type); }

  await dbRun(`UPDATE ${actualTable} SET ${sets.join(', ')} ${whereClause}`, args);

  // For matter updates, log a motion change event
  if (actualTable === 'matter' && input.id) {
    await executeCreate({
      table: 'motion',
      type: 'change',
      ref: input.id,
      scope,
      data: { changed: Object.keys(input.patch) },
      by: 'system'
    });
  }

  return { success: true, updated: nowUnix };
}

// ============================================================
// executeDelete — Physically delete or soft delete depending on table
// ============================================================
export async function executeDelete(input: {
  table: string;
  id?: string;
  scope?: string;
  src?: string;
  rel?: string;
  tgt?: string;
  [key: string]: any;
}) {
  const scope = input.scope || 'ws:global';

  if (input.table === 'graph') {
    if (input.src && input.rel && input.tgt) {
      await dbRun(
        `DELETE FROM graph WHERE src = ? AND rel = ? AND tgt = ? AND scope = ?`,
        [input.src, input.rel, input.tgt, scope]
      );
      return { success: true, status: 'deleted' };
    }
    throw new Error('src, rel, tgt required for graph delete');
  }

  // Soft delete matter by setting status = 'archived'
  if (input.table === 'matter' && input.id) {
    await executeUpdate({
      table: 'matter',
      id: input.id,
      scope,
      patch: { status: 'archived' }
    });
    return { success: true, status: 'soft_deleted' };
  }

  // Soft delete inbox by setting status = 'archived'
  if (input.table === 'inbox' && input.id) {
    await dbRun(
      `UPDATE inbox SET status = 'archived' WHERE id = ? AND scope = ?`,
      [input.id, scope]
    );
    return { success: true, status: 'soft_deleted' };
  }

  throw new Error(`Deletion not supported for table: ${input.table}`);
}

// ============================================================
// executeLink — Toggle graph edge
// ============================================================
export async function executeLink(input: {
  src: string;
  rel: string;
  tgt: string;
  scope?: string;
  active?: boolean;
}) {
  const scope = input.scope || 'ws:global';
  const active = input.active !== undefined ? input.active : true;

  if (!active) {
    return executeDelete({
      table: 'graph',
      src: input.src,
      rel: input.rel,
      tgt: input.tgt,
      scope
    });
  }

  return executeCreate({
    table: 'graph',
    src: input.src,
    rel: input.rel,
    tgt: input.tgt,
    scope
  });
}

// ============================================================
// executeSearch — Query memory (Mocked/S3 listing now since memory table is removed)
// ============================================================
export async function executeSearch(input: {
  query: string;
  scope?: string;
  limit?: number;
}) {
  // SQLite-based search on memory table is deprecated as memory moves to S3.
  // Return empty list to prevent runtime failure of legacy search wrappers.
  return { rows: [], count: 0 };
}

// ============================================================
// Legacy compatibility wrappers (kept for backward compatibility)
// ============================================================
export async function createMatter(input: any) {
  return executeCreate({ ...input, table: 'matter' });
}

export async function getMatter(input: any) {
  return executeRead({ ...input, table: 'matter' });
}

export async function listMatters(input: any) {
  return executeRead({ ...input, table: 'matter' });
}

export async function updateMatter(input: any) {
  return executeUpdate({ ...input, table: 'matter', patch: input.patch || {} });
}

export async function appendMotion(input: any) {
  return executeCreate({ ...input, table: 'motion' });
}

export async function readMotions(input: any) {
  return executeRead({ ...input, table: 'motion' });
}

export async function linkGraph(input: any) {
  return executeLink(input);
}

export async function traverseGraph(input: any) {
  return executeRead({ ...input, table: 'graph' });
}

export async function setAttr(input: any) {
  const matter = await dbGet('SELECT data FROM matter WHERE id = ?', [input.matterId]);
  const data = parseJson(matter?.data);
  data[input.key] = input.val ?? input.num ?? null;
  await executeUpdate({
    table: 'matter',
    id: input.matterId,
    patch: { data }
  });
  return { matter: input.matterId, key: input.key, status: 'set' };
}

export async function readForm(input: any) {
  return executeRead({ ...input, table: 'form' });
}

export async function searchMemory(input: any) {
  return executeSearch(input);
}

export async function storeMemory(input: any) {
  // S3 memory storage must be done via direct S3 API integration.
  // This legacy SQLite-based memory function returns success mock.
  return { id: `mem_${generateUlid()}`, status: 'skipped_sqlite' };
}
