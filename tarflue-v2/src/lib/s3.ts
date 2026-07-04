/**
 * Railway S3 storage — upload, download, presigned URLs.
 * Uses S3-compatible API (R2-compatible).
 */

import { executeCreate, executeRead } from './helpers';

interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

function getConfig(env: any): S3Config {
  return {
    endpoint: env.RAILWAY_S3_ENDPOINT || 'https://s3.ap-south-1.amazonaws.com',
    bucket: env.RAILWAY_S3_BUCKET || 'tarai-storage',
    accessKey: env.RAILWAY_S3_ACCESS_KEY || '',
    secretKey: env.RAILWAY_S3_SECRET_KEY || '',
  };
}

/**
 * Upload a file to Railway S3
 */
export async function uploadDocument(
  env: any,
  scope: string,
  category: string,
  fileName: string,
  fileContent: ArrayBuffer,
  mimeType: string,
  uploadedBy: string
): Promise<{ docId: string; storageKey: string; url: string }> {
  const config = getConfig(env);
  const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const storageKey = `${scope}/${category}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${docId}.${fileName.split('.').pop()}`;

  // Upload to S3
  const url = `${config.endpoint}/${config.bucket}/${storageKey}`;
  const auth = btoa(`${config.accessKey}:${config.secretKey}`);

  await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Authorization': `Basic ${auth}`,
    },
    body: fileContent,
  });

  // Create matter row
  await executeCreate({
    table: 'matter',
    type: 'document',
    title: fileName,
    data: {
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: fileContent.byteLength,
      storage_key: storageKey,
      uploaded_by: uploadedBy,
    },
    scope,
  });

  // Link to workspace
  await executeCreate({
    table: 'graph',
    src: scope,
    rel: 'has_document',
    tgt: docId,
  });

  return { docId, storageKey, url };
}

/**
 * Generate a presigned URL for download
 */
export async function getPresignedUrl(
  env: any,
  storageKey: string,
  expiresIn = 3600
): Promise<string> {
  const config = getConfig(env);
  const url = `${config.endpoint}/${config.bucket}/${storageKey}`;
  // In production, generate actual S3 presigned URL
  // For now, return direct URL (requires public bucket or signed URL)
  return url;
}

/**
 * Get document metadata from matter table
 */
export async function getDocument(docId: string): Promise<any> {
  const result = await executeRead({
    table: 'matter',
    id: docId,
    limit: 1,
  });
  return result.rows?.[0] || null;
}

/**
 * List documents for a workspace
 */
export async function listDocuments(
  scope: string,
  category?: string
): Promise<any[]> {
  const filters = category
    ? [{ key: 'storage_key', val: `${scope}/${category}/` }]
    : undefined;

  const result = await executeRead({
    table: 'matter',
    type: 'document',
    scope,
    active: true,
    filters,
    limit: 100,
  });

  return result.rows || [];
}

/**
 * Soft-delete a document
 */
export async function deleteDocument(docId: string): Promise<boolean> {
  const { executeUpdate } = await import('./helpers');
  await executeUpdate({
    table: 'matter',
    id: docId,
    patch: { active: 0 },
  });
  return true;
}
