import { getUserDb } from "./db";
import * as SecureStore from "expo-secure-store";
import { splitText } from "./textSplitter";

// v5: chunked embeddings — one vector per text chunk (500/100 overlap). Bumping
// the key forces a one-time re-index of all forms with the corrected encoding.
const SYNC_FLAG_KEY = "tar_vector_store_initial_sync_done_v5_chunked";

let embeddingFn: ((text: string) => Promise<number[]>) | null = null;

export function setEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  embeddingFn = fn;
  console.log('[VEC] embedding function registered → search/index now LIVE');
}

// ── logging helpers ────────────────────────────────────────────────────────
function now() {
  return Date.now();
}

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

export function float32ArrayToBlob(vector: number[]): Uint8Array {
  const floatArray = new Float32Array(vector);
  return new Uint8Array(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength);
}

export function vectorToText(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export function blobToFloat32Array(blob: any): Float32Array {
  if (blob instanceof ArrayBuffer) {
    return new Float32Array(blob);
  }
  let bytes: Uint8Array;
  if (blob instanceof Uint8Array) {
    bytes = blob;
  } else if (blob && blob.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(blob.buffer, blob.byteOffset || 0, blob.byteLength ?? blob.length ?? 0);
  } else {
    bytes = new Uint8Array(blob);
  }
  if (bytes.byteOffset % 4 === 0) {
    return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4));
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
  return parts.join('\n\n');
}

export async function upsertFormVector(
  id: string,
  form: {
    title: string;
    type?: string | null;
    scope?: string | null;
    code?: string | null;
    data?: string | null;
    owner?: string | null;
  }
) {
  console.log(`[VEC] ┌─ UPSERT form=${id} title="${clip(form.title)}" type=${form.type ?? '-'} scope=${form.scope ?? '-'}`);
  if (!embeddingFn) {
    console.warn('[VEC] └─ ABORT: embedding function not set (model not loaded)');
    return;
  }
  try {
    const text = formToString(form);
    const chunks = splitText(text);
    console.log(`[VEC] │  text (${text.length} chars) → ${chunks.length} chunk(s)`);

    const db = getUserDb();
    await db.run("DELETE FROM memory WHERE id = ?", [id]);

    const meta = JSON.stringify({
      table: 'form',
      scope: form.scope || 'p',
      type: form.type || '',
      title: form.title || '',
      owner: form.owner || null
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const tEmb = now();
      const vector = await embeddingFn(chunk);
      console.log(`[VEC] │  chunk ${i}/${chunks.length} (${chunk.length} chars) → vectorized in ${now() - tEmb}ms → ${previewVector(vector)}`);

      const vecText = vectorToText(vector);
      await db.run(
        "INSERT INTO memory (id, chunk, text, embedding, meta) VALUES (?, ?, ?, vector32(?), ?)",
        [id, i, chunk, vecText, meta]
      );
    }

    console.log(`[VEC] └─ STORED ${chunks.length} chunk(s) for form=${id}`);
  } catch (e) {
    console.error(`[VEC] └─ FAILED upsert form=${id}:`, e);
  }
}

export async function deleteFormVector(id: string) {
  console.log(`[VEC] ┌─ DELETE vector form=${id}`);
  try {
    const db = getUserDb();
    const res = await db.run("DELETE FROM memory WHERE id = ?", [id]);
    console.log(`[VEC] └─ removed from memory table (changes=${res?.changes ?? '?'})`);
  } catch (e) {
    console.error(`[VEC] └─ FAILED delete form=${id}:`, e);
  }
}

export async function searchFormVectors(
  query: string,
  limit: number = 10
): Promise<{ formId: string; similarity: number }[]> {
  console.log(`[VEC] ╔═ SEARCH q="${clip(query)}" limit=${limit}`);
  if (!embeddingFn) {
    console.warn('[VEC] ╚═ ABORT: embedding function not set (model not loaded)');
    return [];
  }
  try {
    const tEmb = now();
    const queryVector = await embeddingFn(query);
    console.log(`[VEC] ║  query vectorized in ${now() - tEmb}ms → ${previewVector(queryVector)}`);

    const tScan = now();
    const db = getUserDb();
    const rows = await db.all(
      `SELECT id, MIN(vector_distance_cos(embedding, vector32(?))) AS dist
         FROM memory GROUP BY id ORDER BY dist LIMIT ?`,
      [vectorToText(queryVector), limit]
    ).catch((err) => {
      console.warn('[VEC] ║  ! native distance query failed:', err);
      return [];
    });

    const ranked = rows
      .filter((r: any) => r.id != null && r.dist != null)
      .map((r: any) => ({ formId: String(r.id), similarity: 1 - Number(r.dist) }));

    if (ranked.length > 0) {
      const sims = ranked.map((r) => r.similarity).sort((a, b) => a - b);
      const min = sims[0];
      const max = sims[sims.length - 1];
      const median = sims[Math.floor(sims.length / 2)];
      console.log(`[VEC] ║  score distribution: min=${(min * 100).toFixed(1)}% median=${(median * 100).toFixed(1)}% max=${(max * 100).toFixed(1)}%`);
    }

    console.log(`[VEC] ║  scored ${ranked.length} in ${now() - tScan}ms — top ${ranked.length}:`);
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

export async function searchFormVectorsDetailed(
  query: string,
  limit: number = 20,
  minSimilarity: number = 0.3
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
        "SELECT id, title, type, scope, data FROM form WHERE id = ? AND active = 1 AND type != 'tool'",
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

      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        console.log(`[VEC] re-index ${i + 1}/${forms.length} form=${f.id}`);
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
