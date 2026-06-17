export interface JwtPayload {
  userId: string;
  scopes: string[];
  exp: number;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [header, payload, signature] = parts;
  
  // Verify signature
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlToBuffer(signature),
    new TextEncoder().encode(`${header}.${payload}`)
  );

  if (!valid) throw new Error("Invalid JWT signature");

  const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  
  // Check expiry
  if (decoded.exp && Date.now() / 1000 > decoded.exp) {
    throw new Error("JWT expired");
  }

  return decoded as JwtPayload;
}

export async function mintJwt(payload: Omit<JwtPayload, "exp">, secret: string, ttlSeconds: number = 900): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const headerB64 = jsonToBase64url(header);
  const payloadB64 = jsonToBase64url(fullPayload);
  const signature = bufferToBase64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${headerB64}.${payloadB64}`)));

  return `${headerB64}.${payloadB64}.${signature}`;
}

function jsonToBase64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToBuffer(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
