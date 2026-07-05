/**
 * Manages per-user Turso databases.
 *
 * Each user gets their own Turso DB for workspace data that syncs
 * with the mobile app via embedded replicas.
 *
 * Uses the Turso Platform API to create databases and tokens.
 * Stores the mapping in D1 (users table).
 * Applies schema on creation so remote DB has tables.
 */

import { SCHEMA_STATEMENTS } from './schema';

const TURSO_API = 'https://api.turso.tech/v1/organizations';
const ORG_SLUG = 'tarapp';

interface UserDbRecord {
  user_id: string;
  turso_db_name: string;
  turso_url: string;
  turso_auth_token: string;
}

/**
 * Get or create a per-user Turso database.
 * Returns { url, authToken } for the user's DB.
 */
export async function getOrCreateUserDb(
  db: D1Database,
  userId: string,
  platformToken: string,
): Promise<{ url: string; authToken: string }> {
  // 1. Check D1 cache
  const existing = await db
    .prepare('SELECT turso_db_name, turso_url, turso_auth_token FROM users WHERE user_id = ?')
    .bind(userId)
    .first<UserDbRecord>();

  if (existing) {
    console.log(`[user-db] Found cached DB for ${userId}: ${existing.turso_db_name}`);
    return { url: existing.turso_url, authToken: existing.turso_auth_token };
  }

  // 2. Create new Turso database
  const dbName = userId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  console.log(`[user-db] Creating Turso DB: ${dbName}`);

  const createRes = await fetch(`${TURSO_API}/${ORG_SLUG}/databases`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: dbName, group: 'default' }),
  });

  const createBody = await createRes.text();
  console.log(`[user-db] Create response: ${createRes.status} ${createBody}`);

  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`Failed to create Turso DB: ${createRes.status} ${createBody}`);
  }

  // 3. Get hostname — from API response or construct it
  let hostname = '';
  if (createRes.ok) {
    try {
      const createData = JSON.parse(createBody);
      hostname = createData?.database?.Hostname || createData?.Hostname || '';
    } catch {}
  }
  if (!hostname) {
    // Fallback: construct from DB name
    hostname = `${dbName}-${ORG_SLUG}.aws-eu-west-1.turso.io`;
  }

  const tursoUrl = hostname.includes('.turso.io')
    ? `libsql://${hostname}`
    : `libsql://${hostname}.turso.io`;

  console.log(`[user-db] Turso URL: ${tursoUrl}`);

  // 4. Create auth token
  const tokenRes = await fetch(`${TURSO_API}/${ORG_SLUG}/databases/${dbName}/auth/tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiration: '90d' }),
  });

  const tokenBody = await tokenRes.text();
  console.log(`[user-db] Token response: ${tokenRes.status} ${tokenBody.slice(0, 100)}`);

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

  // 5. Store in D1
  await db
    .prepare(
      'INSERT OR REPLACE INTO users (user_id, turso_db_name, turso_url, turso_auth_token) VALUES (?, ?, ?, ?)'
    )
    .bind(userId, dbName, tursoUrl, authToken)
    .run();

  console.log(`[user-db] Stored in D1: ${userId} → ${dbName}`);

  // 6. Apply schema via Turso HTTP API (with retry — new DBs need a moment)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const pipelineUrl = `https://${hostname}/v2/pipeline`;
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
      console.log(`[user-db] Schema pipeline attempt ${attempt}: ${pipeRes.status} ${pipeBody.slice(0, 200)}`);
      if (pipeRes.ok) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (schemaErr) {
      console.warn(`[user-db] Schema attempt ${attempt} failed:`, schemaErr);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  return { url: tursoUrl, authToken };
}
