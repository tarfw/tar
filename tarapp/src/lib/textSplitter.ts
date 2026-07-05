/**
 * Minimal recursive character text splitter — a dependency-free port of
 * LangChain's / react-native-rag's RecursiveCharacterTextSplitter.
 *
 * Long documents embed badly as a single vector: anything past the truncation
 * limit is invisible to search, and averaging a whole doc into one vector
 * dilutes the cosine signal of any one passage. Splitting into overlapping
 * chunks (one vector each) and aggregating by MAX similarity per record fixes
 * both — a query only needs to match a single chunk.
 *
 * Algorithm: try the coarsest separator first ("\n\n"), recurse into a finer
 * separator for any piece still larger than chunkSize, then greedily merge
 * adjacent pieces up to chunkSize, carrying `chunkOverlap` trailing characters
 * from each emitted chunk into the next so context isn't severed at the seam.
 */

export interface SplitOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

/** Split `text` into chunks. Always returns at least one chunk (possibly ''). */
export function splitText(text: string, opts: SplitOptions = {}): string[] {
  const chunkSize = opts.chunkSize ?? 500;
  const chunkOverlap = opts.chunkOverlap ?? 100;
  const separators = opts.separators ?? DEFAULT_SEPARATORS;

  const trimmed = (text ?? '').trim();
  if (!trimmed) return [''];
  if (trimmed.length <= chunkSize) return [trimmed];

  const pieces = splitRecursive(trimmed, separators, chunkSize);
  return mergePieces(pieces, chunkSize, chunkOverlap);
}

/**
 * Break text into atomic pieces no larger than chunkSize where possible, by
 * walking from the coarsest separator to the finest. The empty separator ''
 * is the base case: a hard character-window split that can always satisfy the
 * size bound.
 */
function splitRecursive(text: string, separators: string[], chunkSize: number): string[] {
  if (text.length <= chunkSize) return text ? [text] : [];

  const [sep, ...rest] = separators.length ? separators : [''];

  if (sep === '') {
    // Base case: no separators left — hard-slice into chunkSize windows.
    const out: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      out.push(text.slice(i, i + chunkSize));
    }
    return out;
  }

  const parts = text.split(sep);
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.length <= chunkSize) {
      out.push(part);
    } else {
      // Still too big — recurse with the next-finer separator.
      out.push(...splitRecursive(part, rest, chunkSize));
    }
  }
  return out;
}

/** Greedily merge pieces up to chunkSize, carrying chunkOverlap chars forward. */
function mergePieces(pieces: string[], chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
      const overlap = chunkOverlap > 0 ? current.slice(-chunkOverlap) : '';
      current = overlap ? `${overlap} ${piece}` : piece;
    } else {
      // A single piece exceeds chunkSize even alone (shouldn't happen after
      // splitRecursive, but guard anyway) — emit it as its own chunk.
      chunks.push(piece);
      current = '';
    }
  }
  if (current) chunks.push(current);

  return chunks.length ? chunks : [''];
}
