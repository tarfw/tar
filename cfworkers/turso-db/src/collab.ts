import { Env, queryTurso } from "./turso";

export async function handleCreateGroup(request: Request, env: Env): Promise<Response> {
  const groupCode = `GRP_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  let groupDbUrl = env.TURSO_URL;
  let groupDbToken = env.TURSO_AUTH_TOKEN;

  const org = env.TURSO_ORG;
  const platformToken = env.TURSO_PLATFORM_API_TOKEN;

  if (platformToken) {
    const dbName = `collab-grp-${Math.random().toString(36).substring(2, 8).toLowerCase()}`;

    const createRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${platformToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: dbName, group: env.TURSO_GROUP })
    });

    if (!createRes.ok) {
      throw new Error(`Turso Platform API database creation failed: ${await createRes.text()}`);
    }

    const createData = await createRes.json() as any;
    groupDbUrl = `libsql://${createData.database.Hostname}`;

    const tokenRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases/${dbName}/auth/tokens`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${platformToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!tokenRes.ok) {
      throw new Error(`Turso Platform API token generation failed: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json() as any;
    groupDbToken = tokenData.jwt;
  }

  const mainUrl = env.TURSO_URL;
  const mainToken = env.TURSO_AUTH_TOKEN;
  if (mainToken) {
    await queryTurso(mainUrl, mainToken,
      "CREATE TABLE IF NOT EXISTS collab_groups (group_code TEXT PRIMARY KEY, sync_url TEXT, auth_token TEXT)"
    );
    await queryTurso(mainUrl, mainToken,
      "INSERT INTO collab_groups (group_code, sync_url, auth_token) VALUES (?, ?, ?)",
      [groupCode, groupDbUrl, groupDbToken]
    );
  }

  return Response.json({ groupCode, syncUrl: groupDbUrl, authToken: groupDbToken });
}

export async function handleJoinGroup(request: Request, env: Env): Promise<Response> {
  const { groupCode } = await request.json() as any;
  if (!groupCode) {
    return Response.json({ error: "Missing groupCode" }, { status: 400 });
  }

  const upperCode = groupCode.toUpperCase();
  let groupDbUrl = env.TURSO_URL;
  let groupDbToken = env.TURSO_AUTH_TOKEN;

  const mainUrl = env.TURSO_URL;
  const mainToken = env.TURSO_AUTH_TOKEN;
  if (mainToken) {
    await queryTurso(mainUrl, mainToken,
      "CREATE TABLE IF NOT EXISTS collab_groups (group_code TEXT PRIMARY KEY, sync_url TEXT, auth_token TEXT)"
    );
    const result = await queryTurso(mainUrl, mainToken,
      "SELECT sync_url, auth_token FROM collab_groups WHERE group_code = ?",
      [upperCode]
    );

    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      const urlVal = row[0]?.value || row[0];
      const tokenVal = row[1]?.value || row[1];
      if (urlVal && tokenVal) {
        groupDbUrl = String(urlVal);
        groupDbToken = String(tokenVal);
      }
    } else {
      return Response.json({ error: `Group ${upperCode} not found` }, { status: 404 });
    }
  }

  return Response.json({ groupCode: upperCode, syncUrl: groupDbUrl, authToken: groupDbToken });
}
