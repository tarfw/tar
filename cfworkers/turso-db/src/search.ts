import { Env, queryTurso, rowsToObjects } from "./turso";

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any;
  const queryText: string = (body.query || body.q || "").trim();
  const categoryFilter: string = (body.category || "").trim();
  const limit: number = Math.min(Number(body.limit) || 20, 50);

  const tursoUrl = env.TURSO_URL;
  const tursoToken = env.TURSO_AUTH_TOKEN;

  if (!queryText) {
    if (categoryFilter) {
      const sql = "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND type = ? LIMIT ?";
      const result = await queryTurso(tursoUrl, tursoToken, sql, [categoryFilter, limit]);
      const matters = rowsToObjects(result);
      const massRecords = await fetchMassForMatters(tursoUrl, tursoToken, matters);
      return Response.json({ matters, mass: massRecords, vectorUsed: false });
    }
    return Response.json({ matters: [], mass: [] });
  }

  let matters: any[] = [];
  let usedVector = false;

  if (env.AI) {
    try {
      const embedRes = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
        text: [queryText],
      });
      const queryVector: number[] = embedRes?.data?.[0] ?? [];
      if (queryVector.length > 0) {
        const vectorLiteral = `[${queryVector.join(",")}]`;
        const catClause = categoryFilter
          ? `AND m.type = '${categoryFilter.replace(/'/g, "")}'`
          : "";
        const vectorSql = `
          SELECT m.id, m.code, m.type, m.scope, m.title, m.data, m.time,
                 vector_distance_cos(mem.vector, vector('${vectorLiteral}')) AS score
          FROM matter m
          JOIN memory mem ON mem.matter = m.id
          WHERE m.public = 1 AND m.scope = 'g' ${catClause}
          ORDER BY score ASC
          LIMIT ${limit}
        `;
        const result = await queryTurso(tursoUrl, tursoToken, vectorSql);
        matters = rowsToObjects(result);
        usedVector = matters.length > 0;
      }
    } catch (aiErr) {
      console.warn("[Search] AI vector search failed, falling back:", aiErr);
    }
  }

  if (!usedVector) {
    const term = `%${queryText}%`;
    const likeSql = categoryFilter
      ? "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND type = ? AND (title LIKE ? OR data LIKE ?) LIMIT ?"
      : "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND (title LIKE ? OR data LIKE ?) LIMIT ?";
    const likeParams = categoryFilter
      ? [categoryFilter, term, term, limit]
      : [term, term, limit];
    const result = await queryTurso(tursoUrl, tursoToken, likeSql, likeParams);
    matters = rowsToObjects(result);
  }

  const massRecords = await fetchMassForMatters(tursoUrl, tursoToken, matters);

  return Response.json({ matters, mass: massRecords, vectorUsed: usedVector });
}

async function fetchMassForMatters(tursoUrl: string, tursoToken: string, matters: any[]): Promise<any[]> {
  if (matters.length === 0) return [];
  const ids = matters.map((m) => m.id);
  const ph = ids.map(() => "?").join(",");
  const result = await queryTurso(
    tursoUrl, tursoToken,
    `SELECT id, matter, type, qty, value, active, data FROM mass WHERE matter IN (${ph}) AND active = 1`,
    ids
  );
  return rowsToObjects(result);
}
