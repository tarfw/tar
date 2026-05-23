import { AwsClient } from "aws4fetch";

export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_DEFAULT_REGION: string;
  RAILWAY_STORAGE_ENDPOINT: string;
  RAILWAY_STORAGE_BUCKET_NAME: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    // Mock/Testing authentication bypass
    let uid = "test-user-123";
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      // If we pass an auth header, we use the token string as the UID for easy testing
      uid = token;
    }

    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      service: "s3",
      region: env.AWS_DEFAULT_REGION || "us-east-1",
    });

    const S3_ENDPOINT = env.RAILWAY_STORAGE_ENDPOINT;
    const BUCKET_NAME = env.RAILWAY_STORAGE_BUCKET_NAME;

    const responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "POST" && url.pathname === "/api/storage/presign-upload") {
      try {
        const { filename, contentType, isPublic } = await request.json() as any;
        if (!filename || !contentType) {
          return new Response(JSON.stringify({ error: "Missing filename or contentType" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const timestamp = Date.now();
        const fileExtension = filename.split(".").pop() || "";
        
        let key = "";
        if (filename === "user.db") {
          key = `private/${uid}/backups/user_backup_${timestamp}.db`;
        } else {
          const folder = isPublic ? "public" : `private/${uid}`;
          key = `${folder}/media/${timestamp}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
        }

        const s3Url = `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

        // 1. Generate signed upload URL (PUT) - valid for 15 minutes (900 seconds)
        const signedUploadRequest = await aws.sign(new Request(s3Url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          }
        }), { aws: { signQuery: true }, expires: 900 });

        // 2. Generate signed download URL (GET) - valid for 90 days (7,776,000 seconds)
        let cachedDownloadUrl = "";
        if (filename !== "user.db") {
          const signedDownloadRequest = await aws.sign(new Request(s3Url, {
            method: "GET",
          }), { aws: { signQuery: true }, expires: 7776000 });
          cachedDownloadUrl = signedDownloadRequest.url;
        }

        return new Response(
          JSON.stringify({
            uploadUrl: signedUploadRequest.url,
            downloadUrl: cachedDownloadUrl,
            key,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/storage/presign-download") {
      try {
        const { key } = await request.json() as any;
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing key" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        // Security Check: If it's a private file, ensure the user can only download their own files
        if (key.startsWith("private/") && !key.startsWith(`private/${uid}/`)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: responseHeaders,
          });
        }

        const s3Url = `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`;
        
        // Generate signed download URL (GET) - valid for 90 days (7,776,000 seconds)
        const signedRequest = await aws.sign(new Request(s3Url, {
          method: "GET",
        }), { aws: { signQuery: true }, expires: 7776000 });

        return new Response(
          JSON.stringify({
            downloadUrl: signedRequest.url,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: responseHeaders,
    });
  },
};
