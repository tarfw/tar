import { dbGet, dbRun } from '@/lib/db';

function parseJson(v: any): any {
  if (!v) return {};
  try { return JSON.parse(String(v)); } catch { return {}; }
}

export async function actionEmbed(input: {
  matterId: string;
  scope: string;
  text: string;
}) {
  const matter = await dbGet('SELECT * FROM matter WHERE id = ?', [input.matterId]);
  const matterType = matter?.type || 'unknown';
  const title = matter?.title || '';

  const chunkSize = 500;
  const overlap = 50;
  const chunks: string[] = [];
  let start = 0;

  while (start < input.text.length) {
    const end = Math.min(start + chunkSize, input.text.length);
    chunks.push(input.text.slice(start, end));
    start += chunkSize - overlap;
  }

  for (let i = 0; i < chunks.length; i++) {
    await dbRun(
      'INSERT OR REPLACE INTO memory (id, chunk, matter, text, embedding, meta) VALUES (?, ?, ?, ?, ?, ?)',
      [
        `${input.matterId}_chunk`,
        i,
        input.matterId,
        chunks[i],
        '',
        JSON.stringify({
          table: 'matter',
          scope: input.scope,
          type: matterType,
          title,
          chunkIndex: i,
          totalChunks: chunks.length,
        }),
      ],
    );
  }

  return { embedded: true, chunks: chunks.length };
}
