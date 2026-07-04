/**
 * OKF (Open Knowledge Format) file storage and integration.
 * Workspace OKF files stored in Railway S3.
 */

interface OKFConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

function getConfig(env: any): OKFConfig {
  return {
    endpoint: env.RAILWAY_S3_ENDPOINT || 'https://s3.ap-south-1.amazonaws.com',
    bucket: env.RAILWAY_S3_BUCKET || 'tarai-storage',
    accessKey: env.RAILWAY_S3_ACCESS_KEY || '',
    secretKey: env.RAILWAY_S3_SECRET_KEY || '',
  };
}

/**
 * Upload an OKF file to S3
 */
export async function uploadOkfFile(
  env: any,
  scope: string,
  path: string,
  content: string
): Promise<{ s3Key: string; url: string }> {
  const config = getConfig(env);
  const s3Key = `workspaces/${scope}/${path}`;

  const url = `${config.endpoint}/${config.bucket}/${s3Key}`;
  const auth = btoa(`${config.accessKey}:${config.secretKey}`);

  await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/markdown',
      'Authorization': `Basic ${auth}`,
    },
    body: content,
  });

  // Update KV cache
  // await env.STOREFRONT_CACHE.put(`okf:${scope}:${path}`, content, { expirationTtl: 300 });

  return { s3Key, url };
}

/**
 * Read an OKF file from S3 (or KV cache)
 */
export async function readOkfFile(
  env: any,
  scope: string,
  path: string
): Promise<string | null> {
  const config = getConfig(env);
  const s3Key = `workspaces/${scope}/${path}`;

  // Try KV cache first
  // const cached = await env.STOREFRONT_CACHE.get(`okf:${scope}:${path}`);
  // if (cached) return cached;

  const url = `${config.endpoint}/${config.bucket}/${s3Key}`;
  const auth = btoa(`${config.accessKey}:${config.secretKey}`);

  const res = await fetch(url, {
    headers: { 'Authorization': `Basic ${auth}` },
  });

  if (!res.ok) return null;

  const content = await res.text();
  // Cache in KV
  // await env.STOREFRONT_CACHE.put(`okf:${scope}:${path}`, content, { expirationTtl: 300 });
  return content;
}

/**
 * Read the root index.md for a workspace
 */
export async function readOkfIndex(
  env: any,
  scope: string
): Promise<string | null> {
  return readOkfFile(env, scope, 'index.md');
}

/**
 * Delete an OKF file from S3
 */
export async function deleteOkfFile(
  env: any,
  scope: string,
  path: string
): Promise<boolean> {
  const config = getConfig(env);
  const s3Key = `workspaces/${scope}/${path}`;

  const url = `${config.endpoint}/${config.bucket}/${s3Key}`;
  const auth = btoa(`${config.accessKey}:${config.secretKey}`);

  const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Basic ${auth}` } });
  return res.ok;
}

/**
 * Initialize workspace OKF structure from template
 */
export async function initWorkspaceOkf(
  env: any,
  scope: string,
  workspaceName: string
): Promise<void> {
  const rootIndex = `# ${workspaceName} Knowledge Base

## Folders
- [business](./business/) — Profile, team, channels
- [products](./products/) — Catalog, categories
- [policies](./policies/) — Returns, delivery, payments
- [reports](./reports/) — SQL queries and output formats
- [macros](./macros/) — Template replies
`;

  const businessIndex = `# Business Profile

## Files
- [profile.md](./profile.md) — Name, type, hours, UPI
`;

  const profile = `# Business Profile

**Name:** ${workspaceName}
**Type:** Business
**Hours:** 9 AM - 9 PM
`;

  await uploadOkfFile(env, scope, 'index.md', rootIndex);
  await uploadOkfFile(env, scope, 'business/index.md', businessIndex);
  await uploadOkfFile(env, scope, 'business/profile.md', profile);
}
