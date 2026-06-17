import { getCurrentUser, getJwt } from "./auth";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const WORKER_URL = "https://tar-sync.tar-54d.workers.dev";
const QUEUE_FILE = `${FileSystem.documentDirectory}sync-offline-queue.json`;

let ws: WebSocket | null = null;
let lastSyncedSeq = 0;
let lastSyncedTime = "1970-01-01T00:00:00.000Z";
let currentScope: string | null = null;
let syncCallbacks: ((data: any) => void)[] = [];
let postSyncCallbacks: (() => Promise<void>)[] = [];
let offlineQueue: Array<{ scope: string; changes: any }> = [];
let queueLoaded = false;

async function loadQueue(): Promise<void> {
  if (queueLoaded) return;
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(QUEUE_FILE);
      offlineQueue = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Sync] Failed to load offline queue:", e);
    offlineQueue = [];
  }
  queueLoaded = true;
}

async function saveQueue(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(offlineQueue));
  } catch (e) {
    console.warn("[Sync] Failed to save offline queue:", e);
  }
}

async function flushQueue(): Promise<void> {
  await loadQueue();
  if (offlineQueue.length === 0) return;

  const pending = [...offlineQueue];
  offlineQueue = [];
  await saveQueue();

  for (const entry of pending) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "client-sync", ...entry.changes }));
        console.log(`[Sync] Flushed ${entry.changes.motion?.length || 0} motion, ${entry.changes.form?.length || 0} form rows`);
      } else {
        offlineQueue.push(entry);
        await saveQueue();
        break;
      }
    } catch (e) {
      console.warn("[Sync] Failed to flush entry:", e);
      offlineQueue.push(entry);
      await saveQueue();
      break;
    }
  }
}

function isJwtExpired(jwt: string, skewSeconds = 60): boolean {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(
      // base64url → base64, then decode
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!json.exp) return false;
    // Treat as expired a bit early to avoid racing the server clock.
    return Date.now() / 1000 >= json.exp - skewSeconds;
  } catch {
    return true;
  }
}

export async function connectToScope(scope: string): Promise<void> {
  disconnect();

  let jwt = await getJwt();
  if (!jwt || isJwtExpired(jwt)) {
    if (jwt) console.log("[Sync] JWT missing or expired, refreshing");
    else console.warn("[Sync] No JWT token, attempting to get one");
    const user = await getCurrentUser();
    if (!user?.idToken) {
      console.warn("[Sync] No user token, cannot connect");
      return;
    }
    const { exchangeForJwt } = await import("./auth");
    jwt = await exchangeForJwt(user.idToken);
    if (!jwt) {
      console.error("[Sync] Failed to get JWT token");
      return;
    }
  }

  const wsUrl = `${WORKER_URL.replace("https://", "wss://")}/api/sync?scope=${scope}&token=${jwt}&ws=1`;
  ws = new WebSocket(wsUrl);

  ws.onopen = async () => {
    console.log(`[Sync] Connected to ${scope}`);
    currentScope = scope;

    ws?.send(JSON.stringify({
      type: "client-init",
      last_synced_seq: lastSyncedSeq,
      last_synced_time: lastSyncedTime
    }));

    await flushQueue();
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log("[Sync] Received:", data.type);

    if (data.type === "server-sync") {
      if (data.motion && data.motion.length > 0) {
        lastSyncedSeq = Math.max(lastSyncedSeq, ...data.motion.map((m: any) => m.seq));
      }
      lastSyncedTime = new Date().toISOString();
      syncCallbacks.forEach(cb => cb(data));
      // After receiving server-sync, push any local changes the DO doesn't have yet
      for (const cb of postSyncCallbacks) {
        try { await cb(); } catch (e) { console.warn("[Sync] Post-sync push failed:", e); }
      }
    } else if (data.type === "client-sync-ack") {
      console.log(`[Sync] Ack: ${data.count} rows synced`);
    } else if (data.type === "broadcast") {
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

export function onPostSync(callback: () => Promise<void>): () => void {
  postSyncCallbacks.push(callback);
  return () => {
    postSyncCallbacks = postSyncCallbacks.filter(cb => cb !== callback);
  };
}

export async function pushChanges(scope: string, changes: {
  motion?: any[];
  form?: any[];
  matter?: any[];
  bond?: any[];
}): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = JSON.stringify({ type: "client-sync", ...changes });
    console.log(`[Sync] Sending client-sync: ${payload.length} bytes`);
    ws.send(payload);
    return;
  }

  console.warn("[Sync] WebSocket not connected, queuing changes offline");
  await loadQueue();
  offlineQueue.push({ scope, changes });
  await saveQueue();
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export function getCurrentScope(): string | null {
  return currentScope;
}

export async function getOfflineQueueSize(): Promise<number> {
  await loadQueue();
  return offlineQueue.length;
}

export function getLastSyncedTime(): string {
  return lastSyncedTime;
}
