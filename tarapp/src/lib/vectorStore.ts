/**
 * Stubbed VectorStore for tarapp.
 * Aligned with dbrules.md (local memory tables are deprecated; search is cloud/tar-search based).
 */

export function setEmbeddingFunction(fn: (text: string) => Promise<number[]>) {
  // No-op
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
  // No-op
}

export async function deleteFormVector(id: string, scope?: string | null) {
  // No-op
}

export async function searchFormVectors(
  query: string,
  limit: number = 10,
  scope?: string | null
): Promise<{ formId: string; similarity: number }[]> {
  return [];
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
  minSimilarity: number = 0.3,
  scope?: string | null
): Promise<VectorSearchResult[]> {
  return [];
}

export async function checkAndSyncExistingForms(scope?: string | null) {
  // No-op
}
