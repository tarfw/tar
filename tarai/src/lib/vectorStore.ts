import { getUserDb } from "./db";
import * as SecureStore from "expo-secure-store";

const SYNC_FLAG_KEY = "tar_vector_store_initial_sync_done";

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;

export function setEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
}

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

export function formToString(form: {
  title: string;
  type?: string | null;
  scope?: string | null;
  code?: string | null;
  data?: string | null;
}): string {
  let text = `Title: ${form.title}`;
  if (form.type) text += `\nType: ${form.type}`;
  if (form.scope) text += `\nScope: ${form.scope}`;
  if (form.code) text += `\nCode: ${form.code}`;
  if (form.data) {
    try {
      const parsed = JSON.parse(form.data);
      if (parsed.body) {
        text += `\nBody: ${parsed.body}`;
      } else if (parsed.description) {
        text += `\nDescription: ${parsed.description}`;
      } else {
        text += `\nData: ${JSON.stringify(parsed)}`;
      }
    } catch {
      text += `\nData: ${form.data}`;
    }
  }
  return text.substring(0, 1000);
}

export async function upsertFormVector(
  id: string,
  form: {
    title: string;
    type?: string | null;
    scope?: string | null;
    code?: string | null;
    data?: string | null;
  }
) {
  if (!embeddingFn) {
    console.warn('[VectorStore] Embedding function not set');
    return;
  }
  try {
    const textToEmbed = formToString(form);
    const vector = await embeddingFn(textToEmbed);
    const blob = float32ArrayToBlob(vector);

    const db = getUserDb();
    await db.run("INSERT OR REPLACE INTO memory (form, vector, embedding) VALUES (?, ?, ?)", [id, blob as any, blob as any]);
    console.log(`[VectorStore] Indexed vector for form ${id}`);
  } catch (e) {
    console.error(`[VectorStore] Failed to upsert vector for form ${id}:`, e);
  }
}

export async function deleteFormVector(id: string) {
  try {
    const db = getUserDb();
    await db.run("DELETE FROM memory WHERE form = ?", [id]);
    console.log(`[VectorStore] Deleted vector for form ${id}`);
  } catch (e) {
    console.error(`[VectorStore] Failed to delete vector for form ${id}:`, e);
  }
}

export async function searchFormVectors(
  query: string,
  limit: number = 10
): Promise<Array<{ formId: string; similarity: number }>> {
  if (!embeddingFn) {
    console.warn('[VectorStore] Embedding function not set');
    return [];
  }
  try {
    const queryVector = await embeddingFn(query);
    const queryFloat32 = new Float32Array(queryVector);

    const db = getUserDb();
    const rows = await db.all("SELECT form, vector FROM memory").catch(() => []);

    const results: Array<{ formId: string; similarity: number }> = [];

    for (const row of rows) {
      if (row.form && row.vector) {
        try {
          const vectorFloat32 = blobToFloat32Array(row.vector);
          const sim = cosineSimilarity(queryFloat32, vectorFloat32);
          results.push({ formId: String(row.form), similarity: sim });
        } catch (err) {
          console.warn(`[VectorStore] Failed calculating similarity for ${row.form}:`, err);
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

export async function checkAndSyncExistingForms() {
  if (!embeddingFn) {
    console.warn('[VectorStore] Embedding function not set, skipping sync');
    return;
  }
  try {
    const isSynced = await SecureStore.getItemAsync(SYNC_FLAG_KEY);
    if (!isSynced) {
      console.log("[VectorStore] Initial sync flag not found. Re-indexing all existing forms...");
      const db = getUserDb();
      const forms = await db.all("SELECT * FROM form").catch(() => []);

      console.log(`[VectorStore] Found ${forms.length} forms to index`);

      for (const f of forms) {
        await upsertFormVector(String(f.id), {
          title: f.title ? String(f.title) : "",
          type: f.type ? String(f.type) : null,
          scope: f.scope ? String(f.scope) : null,
          code: f.code ? String(f.code) : null,
          data: f.data ? String(f.data) : null
        });
      }

      await SecureStore.setItemAsync(SYNC_FLAG_KEY, "true");
      console.log("[VectorStore] Initial sync complete!");
    }
  } catch (e) {
    console.error("[VectorStore] Check and sync failed:", e);
  }
}
