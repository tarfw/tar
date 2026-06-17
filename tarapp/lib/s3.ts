import * as FileSystem from "expo-file-system/legacy";
import { FileSystemUploadType } from "expo-file-system/legacy";

// Hardcoded deployed worker fallback for easy testing
const CLOUDFLARE_WORKER_URL = "https://s3storage.tar-54d.workers.dev";

async function getAuthHeaders() {
  // Mock authentication header for now (used to route files under private/test-user-123/)
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-user-123",
  };
}

export interface UploadResult {
  key: string;
  downloadUrl: string;
}

/**
 * Requests presigned URLs (PUT and 90-day GET) and uploads a local file to S3
 */
export async function uploadFileToS3(
  localUri: string,
  filename: string,
  contentType: string,
  isPublic: boolean,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const headers = await getAuthHeaders();
  
  // 1. Get presigned upload (PUT) and download (GET) URLs from Cloudflare Worker
  const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/storage/presign-upload`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filename, contentType, isPublic }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get presigned URLs from Cloudflare Worker: ${errText}`);
  }

  const { uploadUrl, downloadUrl, key } = await response.json();

  // 2. Perform direct binary upload to S3 via PUT
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    localUri,
    {
      headers: {
        "Content-Type": contentType,
      },
      httpMethod: "PUT",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
    },
    (data) => {
      if (onProgress) {
        const progress = data.totalBytesSent / data.totalBytesExpectedToSend;
        onProgress(progress);
      }
    }
  );

  const result = await uploadTask.uploadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`S3 upload failed with status ${result?.status || 'unknown'}`);
  }

  return { key, downloadUrl };
}

/**
 * Fallback to lazy-generate/refresh a temporary download URL if needed
 */
export async function getDownloadUrl(key: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/storage/presign-download`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate download URL");
  }

  const data = await response.json();
  return data.downloadUrl;
}
