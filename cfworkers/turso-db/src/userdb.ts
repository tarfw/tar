import { Env } from "./turso";

export async function handleGetOrCreateDb(request: Request, env: Env): Promise<Response> {
  const { userId } = await request.json() as any;
  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const org = env.TURSO_ORG;
  const platformToken = env.TURSO_PLATFORM_API_TOKEN;
  const groupName = env.TURSO_GROUP;

  if (!platformToken) {
    throw new Error("Missing TURSO_PLATFORM_API_TOKEN");
  }

  const sanitizedUserId = userId.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  const dbName = `u${sanitizedUserId}`.substring(0, 64);

  let dbUrl = "";
  let dbToken = "";

  const listRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${platformToken}` }
  });

  if (!listRes.ok) {
    throw new Error(`Turso Platform API listing failed: ${await listRes.text()}`);
  }

  const listData = await listRes.json() as any;
  const existingDb = listData.databases?.find((d: any) => d.Name === dbName);

  if (existingDb) {
    dbUrl = `libsql://${existingDb.Hostname}`;
  } else {
    const createRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${platformToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: dbName, group: groupName })
    });

    if (!createRes.ok) {
      throw new Error(`Turso Platform API database creation failed: ${await createRes.text()}`);
    }

    const createData = await createRes.json() as any;
    dbUrl = `libsql://${createData.database.Hostname}`;
  }

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
  dbToken = tokenData.jwt;

  return Response.json({ userId, syncUrl: dbUrl, authToken: dbToken });
}
