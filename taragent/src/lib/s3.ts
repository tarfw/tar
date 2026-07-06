/**
 * Railway S3 storage — upload, download, presigned URLs.
 * Uses lightweight S3 client (no DOMParser dependency).
 */

import { s3Put, s3Get, getS3Config, s3Presign } from './s3-client';
import { executeCreate, executeRead } from './helpers';

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
  const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const storageKey = `${scope}/${category}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${docId}.${fileName.split('.').pop()}`;

  await s3Put(env, storageKey, fileContent, mimeType);

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

  await executeCreate({
    table: 'graph',
    src: scope,
    rel: 'has_document',
    tgt: docId,
  });

  const url = await s3Presign(env, storageKey, 604800); // 7 days expiration for view
  return { docId, storageKey, url };
}

/**
 * Generate a presigned URL for download
 */
export async function getPresignedUrl(env: any, storageKey: string, expiresIn = 3600): Promise<string> {
  return s3Presign(env, storageKey, expiresIn);
}

/**
 * Get document metadata from matter table
 */
export async function getDocument(docId: string): Promise<any> {
  const result = await executeRead({ table: 'matter', id: docId, limit: 1 });
  return result.rows?.[0] || null;
}

/**
 * List documents for a workspace
 */
export async function listDocuments(scope: string, category?: string): Promise<any[]> {
  const filters = category
    ? [{ key: 'storage_key', val: `${scope}/${category}/` }]
    : undefined;
  const result = await executeRead({ table: 'matter', type: 'document', scope, active: true, filters, limit: 100 });
  return result.rows || [];
}

/**
 * Soft-delete a document
 */
export async function deleteDocument(docId: string): Promise<boolean> {
  const { executeUpdate } = await import('./helpers');
  await executeUpdate({ table: 'matter', id: docId, patch: { active: 0 } });
  return true;
}

