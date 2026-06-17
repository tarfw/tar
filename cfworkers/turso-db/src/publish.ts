import { Env, queryTurso } from "./turso";

export async function handlePublish(request: Request, env: Env): Promise<Response> {
  const { matter, massRecords = [], relations = [] } = await request.json() as any;
  if (!matter || !matter.id) {
    return Response.json({ error: "Missing matter or matter id" }, { status: 400 });
  }

  const tursoUrl = env.TURSO_URL;
  const tursoToken = env.TURSO_AUTH_TOKEN;

  let matterDataStr = null;
  let matterDataObj: any = {};
  if (matter.data) {
    if (typeof matter.data === "string") {
      matterDataStr = matter.data;
      try { matterDataObj = JSON.parse(matter.data); } catch (_) {}
    } else {
      matterDataStr = JSON.stringify(matter.data);
      matterDataObj = matter.data;
    }
  }

  const timeStr = matter.time || new Date().toISOString();

  const statements: any[] = [];

  statements.push({
    q: `INSERT INTO matter (id, code, type, scope, owner, title, public, data, time)
        VALUES (?, ?, ?, 'g', ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = CASE WHEN json_extract(matter.data, '$.verified') IS NOT 1 THEN excluded.title ELSE matter.title END,
          data = CASE WHEN json_extract(matter.data, '$.verified') IS NOT 1 THEN excluded.data ELSE matter.data END,
          time = excluded.time`,
    params: [
      matter.id,
      matter.code || matter.id,
      matter.type || "product",
      matter.owner || "crowdsourced",
      matter.title || "",
      matterDataStr,
      timeStr
    ]
  });

  if (Array.isArray(massRecords)) {
    for (const mass of massRecords) {
      statements.push({
        q: "INSERT OR REPLACE INTO mass (id, matter, type, scope, qty, value, active, geo, start, end, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          mass.id,
          mass.matter,
          mass.type || null,
          mass.scope || null,
          mass.qty !== null && mass.qty !== undefined ? parseFloat(mass.qty) : null,
          mass.value !== null && mass.value !== undefined ? parseFloat(mass.value) : null,
          mass.active !== undefined ? mass.active : 1,
          mass.geo || null,
          mass.start || null,
          mass.end || null,
          mass.data || null,
          mass.time || new Date().toISOString()
        ]
      });
    }
  }

  if (Array.isArray(relations)) {
    for (const rel of relations) {
      if (!rel || !rel.src || !rel.tgt || !rel.type) continue;
      statements.push({
        q: `INSERT INTO relation (src, tgt, type, weight, time) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(src, tgt, type) DO UPDATE SET weight = excluded.weight, time = excluded.time`,
        params: [
          rel.src,
          rel.tgt,
          rel.type,
          rel.weight !== null && rel.weight !== undefined ? parseFloat(rel.weight) : 1.0,
          rel.time || new Date().toISOString()
        ]
      });
    }
  }

  const requests = statements.map(stmt => ({
    type: "execute",
    stmt: {
      sql: stmt.q,
      args: stmt.params.map((p: any) => {
        if (p === null) return { type: "null" };
        if (typeof p === "number") return { type: "float", value: p };
        return { type: "text", value: String(p) };
      })
    }
  }));
  requests.push({ type: "close" } as any);

  const httpTursoUrl = tursoUrl.replace("libsql://", "https://");
  const tursoRes = await fetch(`${httpTursoUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests })
  });

  if (!tursoRes.ok) {
    const errText = await tursoRes.text();
    throw new Error(`Turso database write failed: ${errText}`);
  }

  if (env.AI) {
    try {
      const textToEmbed = `${matter.title || ""} ${matter.type || ""} ${matterDataObj.brand || ""}`.trim();
      if (textToEmbed) {
        const embedRes = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
          text: [textToEmbed],
        });
        const vector = embedRes?.data?.[0];
        if (vector && vector.length > 0) {
          const vectorLiteral = `[${vector.join(",")}]`;
          await queryTurso(
            tursoUrl,
            tursoToken,
            "INSERT OR REPLACE INTO memory (matter, vector) VALUES (?, vector(?))",
            [matter.id, vectorLiteral]
          );
        }
      }
    } catch (aiErr) {
      console.error("[Publish] Vector generation failed:", aiErr);
    }
  }

  return Response.json({ success: true });
}
