import { getUserDb } from "./db";
import * as SecureStore from "expo-secure-store";

const SYNC_FLAG_KEY = "tar_vector_store_initial_sync_done";

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;

export function setEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
  console.log('[VEC] embedding function registered → search/index now LIVE');
}

// ── logging helpers ────────────────────────────────────────────────────────
function now() {
  return Date.now();
}

/** Compact preview of a vector: dims, magnitude, first few values. */
function previewVector(v: number[] | Float32Array): string {
  const len = v.length;
  let sumSq = 0;
  for (let i = 0; i < len; i++) sumSq += v[i] * v[i];
  const mag = Math.sqrt(sumSq);
  const head = Array.from(v.slice(0, 4))
    .map((x) => x.toFixed(4))
    .join(', ');
  return `dims=${len} |v|=${mag.toFixed(4)} head=[${head}…]`;
}

function clip(text: string, n = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
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
  // Embed ONLY real content (title + body). Metadata like Type/Scope/Code is
  // constant across rows and absent from search queries, so including it adds a
  // shared offset vector that compresses cosine scores and drowns the signal.
  const parts: string[] = [];
  if (form.title) parts.push(form.title);
  if (form.code) parts.push(form.code);
  if (form.data) {
    try {
      const parsed = JSON.parse(form.data);
      const body = parsed.body || parsed.description || parsed.note;
      if (body) parts.push(String(body));
      else parts.push(JSON.stringify(parsed));
    } catch {
      parts.push(form.data);
    }
  }
  return parts.join('. ').substring(0, 1000);
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
  console.log(`[VEC] ┌─ UPSERT form=${id} title="${clip(form.title)}" type=${form.type ?? '-'} scope=${form.scope ?? '-'}`);
  if (!embeddingFn) {
    console.warn('[VEC] └─ ABORT: embedding function not set (model not loaded)');
    return;
  }
  try {
    const textToEmbed = formToString(form);
    console.log(`[VEC] │  text→embed (${textToEmbed.length} chars): "${clip(textToEmbed, 80)}"`);

    const tEmb = now();
    const vector = await embeddingFn(textToEmbed);
    console.log(`[VEC] │  vectorized in ${now() - tEmb}ms → ${previewVector(vector)}`);

    const blob = float32ArrayToBlob(vector);
    console.log(`[VEC] │  blob ${blob.byteLength} bytes (${vector.length}×f32)`);

    const tDb = now();
    const db = getUserDb();
    const res = await db.run("INSERT OR REPLACE INTO memory (form, vector, embedding) VALUES (?, ?, ?)", [id, blob as any, blob as any]);
    console.log(`[VEC] └─ STORED in memory table in ${now() - tDb}ms (changes=${res?.changes ?? '?'})`);
  } catch (e) {
    console.error(`[VEC] └─ FAILED upsert form=${id}:`, e);
  }
}

export async function deleteFormVector(id: string) {
  console.log(`[VEC] ┌─ DELETE vector form=${id}`);
  try {
    const db = getUserDb();
    const res = await db.run("DELETE FROM memory WHERE form = ?", [id]);
    console.log(`[VEC] └─ removed from memory table (changes=${res?.changes ?? '?'})`);
  } catch (e) {
    console.error(`[VEC] └─ FAILED delete form=${id}:`, e);
  }
}

export async function searchFormVectors(
  query: string,
  limit: number = 10
): Promise<Array<{ formId: string; similarity: number }>> {
  console.log(`[VEC] ╔═ SEARCH q="${clip(query)}" limit=${limit}`);
  if (!embeddingFn) {
    console.warn('[VEC] ╚═ ABORT: embedding function not set (model not loaded)');
    return [];
  }
  try {
    const tEmb = now();
    const queryVector = await embeddingFn(query);
    const queryFloat32 = new Float32Array(queryVector);
    console.log(`[VEC] ║  query vectorized in ${now() - tEmb}ms → ${previewVector(queryFloat32)}`);

    const tScan = now();
    const db = getUserDb();
    const rows = await db.all("SELECT form, vector FROM memory").catch(() => []);
    console.log(`[VEC] ║  scanning ${rows.length} stored vector(s)…`);

    const results: Array<{ formId: string; similarity: number }> = [];

    for (const row of rows) {
      if (row.form && row.vector) {
        try {
          const vectorFloat32 = blobToFloat32Array(row.vector);
          const sim = cosineSimilarity(queryFloat32, vectorFloat32);
          results.push({ formId: String(row.form), similarity: sim });
        } catch (err) {
          console.warn(`[VEC] ║  ! similarity failed for ${row.form}:`, err);
        }
      }
    }

    const ranked = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`[VEC] ║  scored ${results.length} in ${now() - tScan}ms — top ${ranked.length}:`);
    ranked.forEach((r, i) =>
      console.log(`[VEC] ║    ${String(i + 1).padStart(2)}. ${(r.similarity * 100).toFixed(1)}%  ${r.formId}`)
    );
    console.log(`[VEC] ╚═ SEARCH done → ${ranked.length} hit(s)`);
    return ranked;
  } catch (e) {
    console.error("[VEC] ╚═ SEARCH FAILED:", e);
    return [];
  }
}

export interface VectorSearchResult {
  formId: string;
  similarity: number;
  title: string;
  type: string | null;
  scope: string | null;
  data: string | null;
}

/**
 * Semantic search that joins vector hits back to their `form` rows so the UI
 * can render real titles/types. `minSimilarity` filters out weak matches
 * (cosine ≥ 0.3 is a sensible floor for normalized embeddings).
 */
export async function searchFormVectorsDetailed(
  query: string,
  limit: number = 20,
  minSimilarity: number = 0.2
): Promise<VectorSearchResult[]> {
  const hits = await searchFormVectors(query, limit);
  if (hits.length === 0) return [];

  console.log(`[VEC] ┄ JOIN+FILTER ${hits.length} hit(s) (minSimilarity=${minSimilarity})`);
  const db = getUserDb();
  const results: VectorSearchResult[] = [];

  for (const hit of hits) {
    if (hit.similarity < minSimilarity) {
      console.log(`[VEC] ┄   drop ${hit.formId} (${(hit.similarity * 100).toFixed(1)}% < threshold)`);
      continue;
    }
    try {
      const row = await db.get(
        "SELECT id, title, type, scope, data FROM form WHERE id = ? AND active = 1",
        [hit.formId]
      );
      if (row) {
        console.log(`[VEC] ┄   keep ${hit.formId} (${(hit.similarity * 100).toFixed(1)}%) title="${clip(String(row.title ?? ''))}"`);
        results.push({
          formId: hit.formId,
          similarity: hit.similarity,
          title: row.title ? String(row.title) : "(untitled)",
          type: row.type ? String(row.type) : null,
          scope: row.scope ? String(row.scope) : null,
          data: row.data ? String(row.data) : null,
        });
      } else {
        console.log(`[VEC] ┄   skip ${hit.formId} (no active form row — orphan vector)`);
      }
    } catch (e) {
      console.warn(`[VEC] ┄   ! join failed for ${hit.formId}:`, e);
    }
  }

  console.log(`[VEC] ┄ RESULTS → ${results.length} row(s) to UI`);
  return results;
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
