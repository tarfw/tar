import { getCurrentUser, getJwt } from "./auth";
import * as SecureStore from "expo-secure-store";

const WORKER_URL = "https://tar-worker.wetarteam.workers.dev";

let ws: WebSocket | null = null;
let lastSyncedSeq = 0;
let lastSyncedTime = "1970-01-01T00:00:00.000Z";
let currentScope: string | null = null;
let syncCallbacks: ((data: any) => void)[] = [];

export async function connectToScope(scope: string): Promise<void> {
  // Disconnect from previous scope
  disconnect();

  // Get JWT token
  let jwt = await getJwt();
  if (!jwt) {
    console.warn("[Sync] No JWT token, attempting to get one");
    const user = await getCurrentUser();
    if (!user?.idToken) {
      console.warn("[Sync] No user token, cannot connect");
      return;
    }
    // Try to exchange for JWT
    const { exchangeForJwt } = await import("./auth");
    jwt = await exchangeForJwt(user.idToken);
    if (!jwt) {
      console.error("[Sync] Failed to get JWT token");
      return;
    }
  }

  // Connect WebSocket with JWT in query params
  const wsUrl = `${WORKER_URL.replace("https://", "wss://")}/api/sync?scope=${scope}&token=${jwt}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log(`[Sync] Connected to ${scope}`);
    currentScope = scope;

    // Send client-init
    ws?.send(JSON.stringify({
      type: "client-init",
      last_synced_seq: lastSyncedSeq,
      last_synced_time: lastSyncedTime
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("[Sync] Received:", data.type);

    if (data.type === "server-sync") {
      // Apply server changes
      if (data.motion && data.motion.length > 0) {
        lastSyncedSeq = Math.max(lastSyncedSeq, ...data.motion.map((m: any) => m.seq));
      }
      lastSyncedTime = new Date().toISOString();

      // Notify callbacks
      syncCallbacks.forEach(cb => cb(data));
    } else if (data.type === "client-sync-ack") {
      console.log(`[Sync] Ack: ${data.count} rows synced`);
    } else if (data.type === "broadcast") {
      // Other client made changes
      syncCallbacks.forEach(cb => cb(data));
    }
  };

  ws.onclose = () => {
    console.log("[Sync] Disconnected");
    ws = null;
  };

  ws.onerror = (error) => {
    console.error("[Sync] WebSocket error:", error);
  };
}

export function disconnect(): void {
  if (ws) {
    ws.close();
    ws = null;
    currentScope = null;
  }
}

export function onSync(callback: (data: any) => void): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}

export async function pushChanges(scope: string, changes: {
  motion?: any[];
  form?: any[];
  matter?: any[];
  bond?: any[];
}): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[Sync] WebSocket not connected, queuing changes");
    return;
  }

  ws.send(JSON.stringify({
    type: "client-sync",
    ...changes
  }));
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getCurrentScope(): string | null {
  return currentScope;
}

  // Get JWT from Worker
  const authResponse = await fetch(`${WORKER_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: user.idToken })
  });

  if (!authResponse.ok) {
    console.error("[Sync] Auth failed:", await authResponse.text());
    return;
  }

  const { token } = await authResponse.json();
  await SecureStore.setItemAsync("sync_token", token);

  // Connect WebSocket
  const wsUrl = `wss://tar-worker.your-subdomain.workers.dev/api/sync?scope=${scope}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log(`[Sync] Connected to ${scope}`);
    currentScope = scope;

    // Send client-init
    ws?.send(JSON.stringify({
      type: "client-init",
      last_synced_seq: lastSyncedSeq,
      last_synced_time: lastSyncedTime
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("[Sync] Received:", data.type);

    if (data.type === "server-sync") {
      // Apply server changes
      lastSyncedSeq = Math.max(lastSyncedSeq, ...data.motion.map((m: any) => m.seq));
      lastSyncedTime = new Date().toISOString();

      // Notify callbacks
      syncCallbacks.forEach(cb => cb(data));
    } else if (data.type === "client-sync-ack") {
      console.log(`[Sync] Ack: ${data.count} rows synced`);
    } else if (data.type === "broadcast") {
      // Other client made changes
      syncCallbacks.forEach(cb => cb(data));
    }
  };

  ws.onclose = () => {
    console.log("[Sync] Disconnected");
    ws = null;
  };

  ws.onerror = (error) => {
    console.error("[Sync] WebSocket error:", error);
  };
}

export function disconnect(): void {
  if (ws) {
    ws.close();
    ws = null;
    currentScope = null;
  }
}

export function onSync(callback: (data: any) => void): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}

export async function pushChanges(scope: string, changes: {
  motion?: any[];
  form?: any[];
  matter?: any[];
  bond?: any[];
}): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[Sync] WebSocket not connected, queuing changes");
    // TODO: Queue changes for later sync
    return;
  }

  ws.send(JSON.stringify({
    type: "client-sync",
    ...changes
  }));
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getCurrentScope(): string | null {
  return currentScope;
}
