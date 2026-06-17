import { Env, queryTurso, rowsToObjects } from "./turso";

export async function handleArchive(request: Request, env: Env): Promise<Response> {
  const { scope, selfDestruct = false } = await request.json() as any;

  if (!env.R2_BUCKET) {
    return Response.json({ error: "R2 bucket not configured. Enable R2 in CF dashboard." }, { status: 503 });
  }

  // Read all data from Turso for this scope
  const tursoUrl = env.TURSO_URL;
  const tursoToken = env.TURSO_AUTH_TOKEN;

  const motionResult = await queryTurso(tursoUrl, tursoToken,
    "SELECT * FROM motion WHERE stream LIKE ? ORDER BY seq ASC", [`${scope}%`]
  );
  const formResult = await queryTurso(tursoUrl, tursoToken,
    "SELECT * FROM form WHERE scope = ?", [scope]
  );
  const matterResult = await queryTurso(tursoUrl, tursoToken,
    "SELECT * FROM matter WHERE scope = ?", [scope]
  );
  const bondResult = await queryTurso(tursoUrl, tursoToken,
    "SELECT * FROM bond WHERE src LIKE ? OR tgt LIKE ?", [`${scope}%`, `${scope}%`]
  );

  const archive = {
    scope,
    archivedAt: new Date().toISOString(),
    motion: rowsToObjects(motionResult),
    form: rowsToObjects(formResult),
    matter: rowsToObjects(matterResult),
    bond: rowsToObjects(bondResult),
  };

  // Write to R2
  const key = `archives/${scope}/${archive.archivedAt}.json`;
  await env.R2_BUCKET.put(key, JSON.stringify(archive, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });

  // Self-destruct: delete scope data from Turso
  if (selfDestruct) {
    const deleteStatements: any[] = [];

    if (archive.motion.length > 0) {
      deleteStatements.push({
        q: `DELETE FROM motion WHERE stream LIKE ?`,
        params: [`${scope}%`]
      });
    }
    if (archive.form.length > 0) {
      deleteStatements.push({
        q: `DELETE FROM form WHERE scope = ?`,
        params: [scope]
      });
    }
    if (archive.matter.length > 0) {
      deleteStatements.push({
        q: `DELETE FROM matter WHERE scope = ?`,
        params: [scope]
      });
    }
    if (archive.bond.length > 0) {
      deleteStatements.push({
        q: `DELETE FROM bond WHERE src LIKE ? OR tgt LIKE ?`,
        params: [`${scope}%`, `${scope}%`]
      });
    }

    if (deleteStatements.length > 0) {
      const requests = deleteStatements.map(stmt => ({
        type: "execute",
        stmt: {
          sql: stmt.q,
          args: stmt.params.map((p: any) => ({ type: "text", value: String(p) }))
        }
      }));
      requests.push({ type: "close" } as any);

      const httpTursoUrl = tursoUrl.replace("libsql://", "https://");
      await fetch(`${httpTursoUrl}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tursoToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests })
      });
    }
  }

  return Response.json({
    success: true,
    key,
    rows: {
      motion: archive.motion.length,
      form: archive.form.length,
      matter: archive.matter.length,
      bond: archive.bond.length,
    },
    selfDestruct,
  });
}

export async function handleRestore(request: Request, env: Env): Promise<Response> {
  const { key } = await request.json() as any;

  if (!env.R2_BUCKET) {
    return Response.json({ error: "R2 bucket not configured" }, { status: 503 });
  }

  const obj = await env.R2_BUCKET.get(key);
  if (!obj) {
    return Response.json({ error: "Archive not found" }, { status: 404 });
  }

  const archive = await obj.json() as any;

  // Restore to Turso
  const tursoUrl = env.TURSO_URL;
  const tursoToken = env.TURSO_AUTH_TOKEN;
  const statements: any[] = [];

  for (const row of archive.motion || []) {
    statements.push({
      q: `INSERT OR REPLACE INTO motion (stream, seq, action, phase, delta, client_ref, data, time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.stream, row.seq, row.action, row.phase, row.delta, row.client_ref, row.data, row.time]
    });
  }

  for (const row of archive.form || []) {
    statements.push({
      q: `INSERT OR REPLACE INTO form (id, code, type, scope, owner, title, public, active, data, time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.code, row.type, row.scope, row.owner, row.title, row.public, row.active, row.data, row.time]
    });
  }

  for (const row of archive.matter || []) {
    statements.push({
      q: `INSERT OR REPLACE INTO matter (id, form, type, scope, qty, value, active, variant, mark, geo, start, end, data, time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.form, row.type, row.scope, row.qty, row.value, row.active, row.variant, row.mark, row.geo, row.start, row.end, row.data, row.time]
    });
  }

  for (const row of archive.bond || []) {
    statements.push({
      q: `INSERT OR REPLACE INTO bond (src, tgt, type, weight, active, time)
          VALUES (?, ?, ?, ?, ?, ?)`,
      params: [row.src, row.tgt, row.type, row.weight, row.active, row.time]
    });
  }

  if (statements.length > 0) {
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
    const res = await fetch(`${httpTursoUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tursoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests })
    });

    if (!res.ok) {
      return Response.json({ error: `Restore failed: ${await res.text()}` }, { status: 500 });
    }
  }

  return Response.json({
    success: true,
    restored: {
      motion: (archive.motion || []).length,
      form: (archive.form || []).length,
      matter: (archive.matter || []).length,
      bond: (archive.bond || []).length,
    },
  });
}
