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
 * Copy vertical template OKF files to a new workspace.
 * verticalFiles: array of {path, content} from the vertical template.
 */
export async function copyVerticalToWorkspace(
  env: any,
  scope: string,
  verticalFiles: Array<{ path: string; content: string }>
): Promise<void> {
  for (const file of verticalFiles) {
    await uploadOkfFile(env, scope, file.path, file.content);
  }
}

/**
 * List all files in a workspace OKF folder.
 * Uses S3 list-like approach via index.md parsing.
 */
export async function listWorkspaceModules(
  env: any,
  scope: string
): Promise<string[]> {
  const indexContent = await readOkfIndex(env, scope);
  if (!indexContent) return [];

  const modules: string[] = [];
  const lines = indexContent.split('\n');
  for (const line of lines) {
    const match = line.match(/\[([^\]]+)\]\(.*modules\/([^/]+)\//);
    if (match) modules.push(match[2]);
  }
  return modules;
}

/**
 * Initialize workspace OKF from a vertical template (stored locally in the Worker).
 * For now, creates a basic structure. Vertical files will be deployed separately.
 */
export async function initWorkspaceFromVertical(
  env: any,
  scope: string,
  workspaceName: string,
  vertical: string,
  modules: string[]
): Promise<void> {
  // Build index.md listing installed modules
  const moduleLinks = modules
    .map((m) => `- [${m}](./modules/${m}/SKILL.md)`)
    .join('\n');

  const rootIndex = `# ${workspaceName}

**Vertical:** ${vertical}
**Modules:** ${modules.join(', ')}

## Modules
${moduleLinks}
`;

  await uploadOkfFile(env, scope, 'index.md', rootIndex);

  // Each module SKILL.md will be uploaded by the calling code
  // (vertical template files are read from the local filesystem or S3 /verticals/ path)
}
