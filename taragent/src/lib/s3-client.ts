/**
 * Lightweight S3 client for Cloudflare Workers.
 * Uses raw fetch with AWS Signature V4 — no DOMParser dependency.
 *
 * Key: all string data is explicitly UTF-8 encoded before hashing
 * to ensure consistent byte representation across runtimes.
 */

import { Sha256 } from '@aws-crypto/sha256-js';

interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

const enc = new TextEncoder();

export function getS3Config(env: any): S3Config {
  return {
    endpoint: env.RAILWAY_S3_ENDPOINT || env.ENDPOINT || 'https://t3.storageapi.dev',
    bucket: env.RAILWAY_S3_BUCKET || env.BUCKET || 'customizable-box-hw-fvnq8',
    accessKey: env.RAILWAY_S3_ACCESS_KEY || env.ACCESS_KEY || '',
    secretKey: env.RAILWAY_S3_SECRET_KEY || env.SECRET_KEY || '',
    region: env.RAILWAY_S3_REGION || env.REGION || 'auto',
  };
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const h = new Sha256(key);
  h.update(enc.encode(data));
  return h.digest();
}

async function sha256hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const h = new Sha256();
  if (typeof data === 'string') {
    h.update(enc.encode(data));
  } else {
    h.update(new Uint8Array(data));
  }
  const buf = await h.digest();
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(
  config: S3Config,
  method: string,
  resourcePath: string,
  body: string | ArrayBuffer | Uint8Array,
  contentType: string,
  queryString = ''
): Promise<{ url: string; headers: Record<string, string> }> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256hex(body);
  const host = new URL(config.endpoint).host;
  const canonicalResource = `/${config.bucket}/${resourcePath}`;
  const url = `${config.endpoint}${canonicalResource}${queryString ? '?' + queryString : ''}`;

  const signedHeaderKeys = ['content-type', 'host', 'x-amz-content-sha256', 'x-amz-date'];
  const headerValues: Record<string, string> = {
    'content-type': contentType,
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headerValues[k]}`).join('\n') + '\n';
  const signedHeaders = signedHeaderKeys.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalResource,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256hex(canonicalRequest)}`;

  const kDate = await hmacSha256(enc.encode(`AWS4${config.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const sigBuf = await hmacSha256(kSigning, stringToSign);
  const signature = [...sigBuf].map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    url,
    headers: {
      'Authorization': `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  };
}

// ── Public API ─────────────────────────────────────────────────────

export async function s3Put(env: any, key: string, body: string | ArrayBuffer | Uint8Array, ct = 'text/markdown'): Promise<void> {
  const c = getS3Config(env);
  const { url, headers } = await signRequest(c, 'PUT', key, body, ct);
  const res = await fetch(url, { method: 'PUT', headers, body, redirect: 'follow' });
  if (!res.ok) throw new Error(`S3 PUT ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function s3Get(env: any, key: string): Promise<string | null> {
  const c = getS3Config(env);
  const { url, headers } = await signRequest(c, 'GET', key, '', 'application/octet-stream');
  const res = await fetch(url, { method: 'GET', headers, redirect: 'follow' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 GET ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.text();
}

export async function s3Delete(env: any, key: string): Promise<boolean> {
  const c = getS3Config(env);
  const { url, headers } = await signRequest(c, 'DELETE', key, '', 'application/octet-stream');
  const res = await fetch(url, { method: 'DELETE', headers, redirect: 'follow' });
  return res.ok;
}

export async function s3List(env: any, prefix: string): Promise<string[]> {
  const c = getS3Config(env);
  const query = `list-type=2&prefix=${encodeURIComponent(prefix)}`;
  const { url, headers } = await signRequest(c, 'GET', '', '', 'application/octet-stream', query);
  const res = await fetch(url, { method: 'GET', headers, redirect: 'follow' });
  if (!res.ok) return [];
  const xml = await res.text();
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  const re = /<Key>([^<]+)<\/Key>/g;
  while ((m = re.exec(xml))) keys.push(m[1]);
  return keys;
}

/**
 * Generate an AWS Signature V4 presigned URL for downloading objects.
 */
export async function s3Presign(env: any, key: string, expiresIn = 3600): Promise<string> {
  const config = getS3Config(env);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = new URL(config.endpoint).host;
  const canonicalResource = `/${config.bucket}/${key}`;
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };

  const sortedQueryString = Object.entries(queryParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalResource,
    sortedQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256hex(canonicalRequest)}`;

  const kDate = await hmacSha256(enc.encode(`AWS4${config.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const sigBuf = await hmacSha256(kSigning, stringToSign);
  const signature = [...sigBuf].map(b => b.toString(16).padStart(2, '0')).join('');

  return `${config.endpoint}${canonicalResource}?${sortedQueryString}&X-Amz-Signature=${signature}`;
}

