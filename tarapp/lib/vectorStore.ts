import { routeDbForEntity, getGlobalDb, getCollabDb, getUserDb } from "./db";
import { generateEmbedding } from "./embeddings";
import * as SecureStore from "expo-secure-store";

const SYNC_FLAG_KEY = "tar_vector_store_initial_sync_done";

export function float32ArrayToBlob(vector: number[]): ArrayBuffer {
  const floatArray = new Float32Array(vector);
  return floatArray.buffer;
}

export function blobToFloat32Array(blob: any): Float32Array {
  if (blob instanceof ArrayBuffer) {
    return new Float32Array(blob);
  }
  if (blob instanceof Uint8Array) {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  }
  if (blob && blob.buffer instanceof ArrayBuffer) {
    return new Float32Array(blob.buffer, blob.byteOffset || 0, (blob.byteLength || blob.length || 0) / 4);
  }
  // Fallback/Convert standard array or other buffer shapes
  const uint8 = new Uint8Array(blob);
  return new Float32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength / 4);
}

export function dotProduct(a: Float32Array, b: Float32Array): number {
  let val = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    val += a[i] * b[i];
  }
  return val;
}

export function magnitude(a: Float32Array): number {
  let val = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    val += a[i] * a[i];
  }
  return Math.sqrt(val);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

export function matterToString(matter: {
  title: string;
  type?: string | null;
  scope?: string | null;
  code?: string | null;
  data?: string | null;
}): string {
  let text = `Title: ${matter.title}`;
  if (matter.type) text += `\nType: ${matter.type}`;
  if (matter.scope) text += `\nScope: ${matter.scope}`;
  if (matter.code) text += `\nCode: ${matter.code}`;
  if (matter.data) {
    try {
      const parsed = JSON.parse(matter.data);
      if (parsed.body) {
        text += `\nBody: ${parsed.body}`;
      } else if (parsed.description) {
        text += `\nDescription: ${parsed.description}`;
      } else {
        text += `\nData: ${JSON.stringify(parsed)}`;
      }
    } catch {
      text += `\nData: ${matter.data}`;
    }
  }
  return text.substring(0, 1000);
}

export async function upsertMatterVector(
  id: string,
  matter: {
    title: string;
    type?: string | null;
    scope?: string | null;
    code?: string | null;
    data?: string | null;
  }
) {
  try {
    const textToEmbed = matterToString(matter);
    const vector = await generateEmbedding(textToEmbed);
    const blob = float32ArrayToBlob(vector);
    
    const db = routeDbForEntity(matter.type || null, matter.scope || null);
    await db.run("INSERT OR REPLACE INTO memory (matter, vector) VALUES (?, ?)", [id, blob as any]);
    console.log(`[VectorStore] Indexed vector for matter ${id} in respective DB`);
    
    try {
      await db.push();
    } catch {
      // Sync fail is acceptable
    }
  } catch (e) {
    console.error(`[VectorStore] Failed to upsert vector for matter ${id}:`, e);
  }
}

export async function deleteMatterVector(id: string, type: string | null, scope: string | null) {
  try {
    const db = routeDbForEntity(type, scope);
    await db.run("DELETE FROM memory WHERE matter = ?", [id]);
    console.log(`[VectorStore] Deleted vector for matter ${id}`);
    
    try {
      await db.push();
    } catch {
      // Sync fail is acceptable
    }
  } catch (e) {
    console.error(`[VectorStore] Failed to delete vector for matter ${id}:`, e);
  }
}

export async function searchMatterVectors(
  query: string,
  limit: number = 10
): Promise<Array<{ matterId: string; similarity: number }>> {
  try {
    const queryVector = await generateEmbedding(query);
    const queryFloat32 = new Float32Array(queryVector);

    const gDb = getGlobalDb();
    const tDb = getCollabDb();
    const uDb = getUserDb();

    const [gRows, tRows, uRows] = await Promise.all([
      gDb.all("SELECT matter, vector FROM memory").catch(() => []),
      tDb.all("SELECT matter, vector FROM memory").catch(() => []),
      uDb.all("SELECT matter, vector FROM memory").catch(() => [])
    ]);

    const allRows = [...gRows, ...tRows, ...uRows];
    const results: Array<{ matterId: string; similarity: number }> = [];

    for (const row of allRows) {
      if (row.matter && row.vector) {
        try {
          const vectorFloat32 = blobToFloat32Array(row.vector);
          const sim = cosineSimilarity(queryFloat32, vectorFloat32);
          results.push({ matterId: String(row.matter), similarity: sim });
        } catch (err) {
          console.warn(`[VectorStore] Failed calculating similarity for ${row.matter}:`, err);
        }
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (e) {
    console.error("[VectorStore] Search failed:", e);
    return [];
  }
}

export async function checkAndSyncExistingMatters() {
  try {
    const isSynced = await SecureStore.getItemAsync(SYNC_FLAG_KEY);
    if (!isSynced) {
      console.log("[VectorStore] Initial sync flag not found. Re-indexing all existing matters...");
      const gDb = getGlobalDb();
      const tDb = getCollabDb();
      const uDb = getUserDb();

      const [gMatters, tMatters, uMatters] = await Promise.all([
        gDb.all("SELECT * FROM matter").catch(() => []),
        tDb.all("SELECT * FROM matter").catch(() => []),
        uDb.all("SELECT * FROM matter").catch(() => [])
      ]);

      const allMatters = [...gMatters, ...tMatters, ...uMatters];
      console.log(`[VectorStore] Found ${allMatters.length} matters to index`);
      
      for (const m of allMatters) {
        await upsertMatterVector(String(m.id), {
          title: m.title ? String(m.title) : "",
          type: m.type ? String(m.type) : null,
          scope: m.scope ? String(m.scope) : null,
          code: m.code ? String(m.code) : null,
          data: m.data ? String(m.data) : null
        });
      }
      
      await SecureStore.setItemAsync(SYNC_FLAG_KEY, "true");
      console.log("[VectorStore] Initial sync complete!");
    }
  } catch (e) {
    console.error("[VectorStore] Check and sync failed:", e);
  }
}
