/**
 * Manages per-workspace Turso databases.
 *
 * Each workspace gets its own Turso DB with 6 tables:
 *   form     — workspace-specific overrides (custom prices, settings)
 *   matter   — current state (stock, orders, staff, customers)
 *   motion   — event log (sales, clock-ins, status changes) — append-only
 *   graph    — relationships (links between items)
 *   tasks    — user inbox (work assigned to people)
 *   memory   — AI memory (customer preferences, patterns)
 *
 * Global database (g:global) has 2 tables:
 *   catalog    — shared product/service/action templates
 *   embeddings — vector embeddings for similarity search
 *
 * Creation flow:
 *   1. Check D1 cache for existing DB
 *   2. Create Turso DB via Platform API
 *   3. Create auth token (365d expiry)
 *   4. Store URL + token in D1 workspaces table
 *   5. Apply 6-table schema via pipeline
 *   6. Return { url, authToken } to caller
 */

import { SCHEMA_STATEMENTS } from './schema';

const TURSO_API = 'https://api.turso.tech/v1/organizations';
const ORG_SLUG = 'tarapp';

interface WorkspaceDbRecord {
  subdomain: string;
  scope: string;
  turso_url?: string;
  turso_auth_token?: string;
}

/**
 * Get or create a per-workspace Turso database.
 * Returns { url, authToken } for the workspace DB.
 */
export async function getOrCreateWorkspaceDb(
  db: D1Database,
  subdomain: string,
  scope: string,
  platformToken: string
): Promise<{ url: string; authToken: string }> {
  // 0. Ensure schema columns exist in D1 workspaces table
  try {
    await db.prepare('ALTER TABLE workspaces ADD COLUMN turso_url TEXT').run();
  } catch {}
  try {
    await db.prepare('ALTER TABLE workspaces ADD COLUMN turso_auth_token TEXT').run();
  } catch {}

  // 1. Check D1 cache
  const existing = await db
    .prepare('SELECT subdomain, scope, turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?')
    .bind(subdomain)
    .first<WorkspaceDbRecord>();

  if (existing?.turso_url && existing?.turso_auth_token) {
    console.log(`[workspace-db] Found cached DB for ${subdomain}: ${existing.turso_url}`);
    return { url: existing.turso_url, authToken: existing.turso_auth_token };
  }

  // 2. Create new Turso database in default group
  const dbName = `ws-${subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')}`;
  console.log(`[workspace-db] Creating Turso DB: ${dbName}`);

  const createRes = await fetch(`${TURSO_API}/${ORG_SLUG}/databases`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: dbName, group: 'default' }),
  });

  const createBody = await createRes.text();
  console.log(`[workspace-db] Create response: ${createRes.status} ${createBody}`);

  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`Failed to create Turso DB: ${createRes.status} ${createBody}`);
  }

  // 3. Get hostname from API response or fallback
  let hostname = '';
  if (createRes.ok) {
    try {
      const createData = JSON.parse(createBody);
      hostname = createData?.database?.Hostname || createData?.Hostname || '';
    } catch {}
  }
  if (!hostname) {
    hostname = `${dbName}-${ORG_SLUG}.aws-eu-west-1.turso.io`;
  }

  const tursoUrl = hostname.includes('.turso.io')
    ? `libsql://${hostname}`
    : `libsql://${hostname}.turso.io`;

  console.log(`[workspace-db] Turso URL: ${tursoUrl}`);

  // 4. Create auth token
  const tokenRes = await fetch(`${TURSO_API}/${ORG_SLUG}/databases/${dbName}/auth/tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiration: '365d' }),
  });

  const tokenBody = await tokenRes.text();
  console.log(`[workspace-db] Token response: ${tokenRes.status}`);

  if (!tokenRes.ok) {
    throw new Error(`Failed to create Turso token: ${tokenRes.status} ${tokenBody}`);
  }

  let authToken = '';
  try {
    const tokenData = JSON.parse(tokenBody);
    authToken = tokenData?.jwt || tokenData?.token || '';
  } catch {}

  if (!authToken) {
    throw new Error('No token returned from Turso API');
  }

  // 5. Update workspaces table in D1
  await db
    .prepare(
      'UPDATE workspaces SET turso_url = ?, turso_auth_token = ? WHERE subdomain = ?'
    )
    .bind(tursoUrl, authToken, subdomain)
    .run();

  console.log(`[workspace-db] Stored in D1: ${subdomain} → ${tursoUrl}`);

  // 6. Apply schema statements to the new database
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cleanHostname = hostname.replace('libsql://', '').replace('.turso.io', '') + '.turso.io';
      const pipelineUrl = `https://${cleanHostname}/v2/pipeline`;
      const statements = SCHEMA_STATEMENTS.map(sql => ({
        type: 'execute',
        stmt: { sql },
      }));
      const pipeRes = await fetch(pipelineUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: statements }),
      });
      const pipeBody = await pipeRes.text();
      console.log(`[workspace-db] Schema pipeline attempt ${attempt}: ${pipeRes.status}`);
      if (pipeRes.ok) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (schemaErr) {
      console.warn(`[workspace-db] Schema attempt ${attempt} failed:`, schemaErr);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  // 7. Run migrations individually (ALTER TABLE fails if column exists, so ignore errors)
  const MIGRATION_SQLS = [
    'ALTER TABLE form ADD COLUMN active INTEGER DEFAULT 1',
    'ALTER TABLE form ADD COLUMN owner TEXT',
    'ALTER TABLE form ADD COLUMN time TEXT',
    'ALTER TABLE matter ADD COLUMN form TEXT',
    'ALTER TABLE matter ADD COLUMN active INTEGER DEFAULT 1',
    'ALTER TABLE matter ADD COLUMN owner TEXT',
    'ALTER TABLE matter ADD COLUMN qty REAL DEFAULT 0',
    'ALTER TABLE matter ADD COLUMN time TEXT',
    'ALTER TABLE matter ADD COLUMN updated TEXT',
    'ALTER TABLE motion ADD COLUMN scope TEXT DEFAULT \'global\'',
  ];
  const cleanHostname2 = hostname.replace('libsql://', '').replace('.turso.io', '') + '.turso.io';
  const pipelineUrl2 = `https://${cleanHostname2}/v2/pipeline`;
  for (const sql of MIGRATION_SQLS) {
    try {
      await fetch(pipelineUrl2, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }] }),
      });
    } catch {}
  }

  return { url: tursoUrl, authToken };
}
