import { AwsClient } from "aws4fetch";

export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_DEFAULT_REGION: string;
  RAILWAY_STORAGE_ENDPOINT: string;
  RAILWAY_STORAGE_BUCKET_NAME: string;
  TURSO_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  TURSO_PLATFORM_API_TOKEN?: string;
  TURSO_ORG?: string;
  TURSO_GROUP?: string;
  // Cloudflare Workers AI binding (configured in wrangler.toml)
  AI?: any;
}

async function queryTurso(tursoUrl: string, tursoToken: string, sql: string, params: any[] = []): Promise<any> {
  const httpTursoUrl = tursoUrl.replace("libsql://", "https://");
  const requests = [
    {
      type: "execute",
      stmt: {
        sql,
        args: params.map((p: any) => {
          if (p === null) return { type: "null" };
          if (typeof p === "number") return { type: "float", value: p };
          return { type: "text", value: String(p) };
        })
      }
    },
    { type: "close" }
  ];
  const res = await fetch(`${httpTursoUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso DB Query Failed: ${text}`);
  }
  const data = await res.json() as any;
  const execResult = data.results?.[0];
  if (execResult?.type === "error") {
    throw new Error(`Turso DB Statement Error: ${execResult.error.message}`);
  }
  return execResult?.response?.result;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    // Mock/Testing authentication bypass
    let uid = "test-user-123";
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      // If we pass an auth header, we use the token string as the UID for easy testing
      uid = token;
    }

    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      service: "s3",
      region: env.AWS_DEFAULT_REGION || "us-east-1",
    });

    const S3_ENDPOINT = env.RAILWAY_STORAGE_ENDPOINT;
    const BUCKET_NAME = env.RAILWAY_STORAGE_BUCKET_NAME;

    const responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "POST" && url.pathname === "/api/storage/presign-upload") {
      try {
        const { filename, contentType, isPublic } = await request.json() as any;
        if (!filename || !contentType) {
          return new Response(JSON.stringify({ error: "Missing filename or contentType" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const timestamp = Date.now();
        const fileExtension = filename.split(".").pop() || "";
        
        let key = "";
        if (filename === "user.db") {
          key = `private/${uid}/backups/user_backup_${timestamp}.db`;
        } else {
          const folder = isPublic ? "public" : `private/${uid}`;
          key = `${folder}/media/${timestamp}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
        }

        const s3Url = `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`;

        // 1. Generate signed upload URL (PUT) - valid for 15 minutes (900 seconds)
        const signedUploadRequest = await aws.sign(new Request(s3Url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
          }
        }), { aws: { signQuery: true }, expires: 900 } as any);

        // 2. Generate signed download URL (GET) - valid for 90 days (7,776,000 seconds)
        let cachedDownloadUrl = "";
        if (filename !== "user.db") {
          const signedDownloadRequest = await aws.sign(new Request(s3Url, {
            method: "GET",
          }), { aws: { signQuery: true }, expires: 7776000 } as any);
          cachedDownloadUrl = signedDownloadRequest.url;
        }

        return new Response(
          JSON.stringify({
            uploadUrl: signedUploadRequest.url,
            downloadUrl: cachedDownloadUrl,
            key,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/storage/presign-download") {
      try {
        const { key } = await request.json() as any;
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing key" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        // Security Check: If it's a private file, ensure the user can only download their own files
        if (key.startsWith("private/") && !key.startsWith(`private/${uid}/`)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: responseHeaders,
          });
        }

        const s3Url = `${S3_ENDPOINT}/${BUCKET_NAME}/${key}`;
        
        // Generate signed download URL (GET) - valid for 90 days (7,776,000 seconds)
        const signedRequest = await aws.sign(new Request(s3Url, {
          method: "GET",
        }), { aws: { signQuery: true }, expires: 7776000 } as any);

        return new Response(
          JSON.stringify({
            downloadUrl: signedRequest.url,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/publish") {
      try {
        const { matter, massRecords, relations } = await request.json() as any;
        if (!matter || !matter.id) {
          return new Response(JSON.stringify({ error: "Missing matter or matter id" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const tursoUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        const tursoToken = env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk3ODg4MzcsImlkIjoiMDE5ZTYzYWUtNWIwMS03ZGU2LWI5Y2UtYmRhNDViMzE0ZWY5IiwicmlkIjoiZmYxMzI2OGEtYzAwMy00OGY2LTg4MTItMjBkNGIyNzJjMTc4In0.psIsvB51C4HKwdwTNOEICDiFo2nAREWRscIqlt8BaPxSPb8nKxmTCY3938PeUa273PWORT1UBMBPmhxn3UdYAQ";

        const statements: any[] = [];
        
        let matterDataStr = null;
        let matterDataObj: any = {};
        if (matter.data) {
          if (typeof matter.data === "string") {
            matterDataStr = matter.data;
            try {
              matterDataObj = JSON.parse(matter.data);
            } catch (_) {}
          } else {
            matterDataStr = JSON.stringify(matter.data);
            matterDataObj = matter.data;
          }
        }

        const timeStr = matter.time || new Date().toISOString();

        // 1. Insert or update published matter in global DB conditionally
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

        // 2. Insert or replace corresponding mass records
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

        // 3. Insert or replace graph relations (e.g. product -> profile 'published_to')
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

        // Build Hrana /v2/pipeline requests
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

        // Make HTTP request to Turso REST API
        // Convert protocol from libsql:// to https:// if needed
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
          console.error("Turso API Error:", errText);
          return new Response(JSON.stringify({ error: `Turso database write failed: ${errText}` }), {
            status: 500,
            headers: responseHeaders,
          });
        }

        console.log(`[Worker] Successfully published matter ${matter.id} and invalidating KV cache...`);

        // Generate vector embedding using Workers AI if present
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
            console.error("[Worker AI] Vector generation failed:", aiErr);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/user/get-or-create-db") {
      try {
        const { userId } = await request.json() as any;
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const org = env.TURSO_ORG || "tarframework";
        const platformToken = env.TURSO_PLATFORM_API_TOKEN;
        const groupName = env.TURSO_GROUP || "default";

        if (!platformToken) {
          throw new Error("Missing TURSO_PLATFORM_API_TOKEN in backend environment");
        }

        // Clean user ID to be used in Turso DB names (lowercase alphanumeric and hyphens, starting with letter/number)
        const sanitizedUserId = userId.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
        const dbName = `u${sanitizedUserId}`.substring(0, 64);

        console.log(`[Turso API] Finding or creating database ${dbName} for user ${userId} in org ${org}...`);

        let dbUrl = "";
        let dbToken = "";

        // 1. Check if database already exists
        const listRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${platformToken}`,
          }
        });

        if (!listRes.ok) {
          const errText = await listRes.text();
          throw new Error(`Turso Platform API listing failed: ${errText}`);
        }

        const listData = await listRes.json() as any;
        const existingDb = listData.databases?.find((d: any) => d.Name === dbName);

        if (existingDb) {
          console.log(`[Turso API] Database ${dbName} already exists`);
          dbUrl = `libsql://${existingDb.Hostname}`;
        } else {
          console.log(`[Turso API] Database ${dbName} does not exist. Creating...`);
          // Create database
          const createRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${platformToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: dbName,
              group: groupName
            })
          });

          if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Turso Platform API database creation failed: ${errText}`);
          }

          const createData = await createRes.json() as any;
          dbUrl = `libsql://${createData.database.Hostname}`;
          console.log(`[Turso API] Created database ${dbName} successfully at ${dbUrl}`);
        }

        // 2. Generate a fresh auth token for this database
        console.log(`[Turso API] Generating token for database ${dbName}...`);
        const tokenRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases/${dbName}/auth/tokens`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${platformToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          throw new Error(`Turso Platform API token generation failed: ${errText}`);
        }

        const tokenData = await tokenRes.json() as any;
        dbToken = tokenData.jwt;

        return new Response(
          JSON.stringify({
            userId,
            syncUrl: dbUrl,
            authToken: dbToken,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        console.error("[Worker Error] get-or-create-db failed:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/collab/create-group") {
      try {
        const groupCode = `GRP_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        let groupDbUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        let groupDbToken = env.TURSO_AUTH_TOKEN || "";
        
        const org = env.TURSO_ORG || "tarframework";
        const platformToken = env.TURSO_PLATFORM_API_TOKEN;
        
        if (platformToken) {
          const dbName = `collab-grp-${Math.random().toString(36).substring(2, 8).toLowerCase()}`;
          console.log(`[Turso API] Creating database ${dbName} for org ${org}...`);
          
          // 1. Create database in Turso group
          const createRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${platformToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: dbName,
              group: env.TURSO_GROUP || "default"
            })
          });
          
          if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Turso Platform API database creation failed: ${errText}`);
          }
          
          const createData = await createRes.json() as any;
          const hostname = createData.database.Hostname;
          groupDbUrl = `libsql://${hostname}`;
          
          // 2. Generate token for database
          console.log(`[Turso API] Generating token for database ${dbName}...`);
          const tokenRes = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases/${dbName}/auth/tokens`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${platformToken}`,
              "Content-Type": "application/json"
            }
          });
          
          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            throw new Error(`Turso Platform API token generation failed: ${errText}`);
          }
          
          const tokenData = await tokenRes.json() as any;
          groupDbToken = tokenData.jwt;
        }

        // Save association to the main database
        const mainUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        const mainToken = env.TURSO_AUTH_TOKEN || "";
        if (mainToken) {
          await queryTurso(mainUrl, mainToken, 
            "CREATE TABLE IF NOT EXISTS collab_groups (group_code TEXT PRIMARY KEY, sync_url TEXT, auth_token TEXT)"
          );
          await queryTurso(mainUrl, mainToken, 
            "INSERT INTO collab_groups (group_code, sync_url, auth_token) VALUES (?, ?, ?)",
            [groupCode, groupDbUrl, groupDbToken]
          );
        }

        return new Response(
          JSON.stringify({
            groupCode,
            syncUrl: groupDbUrl,
            authToken: groupDbToken,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/collab/join-group") {
      try {
        const { groupCode } = await request.json() as any;
        if (!groupCode) {
          return new Response(JSON.stringify({ error: "Missing groupCode" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const upperCode = groupCode.toUpperCase();
        let groupDbUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        let groupDbToken = env.TURSO_AUTH_TOKEN || "";

        // Query association from main database
        const mainUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        const mainToken = env.TURSO_AUTH_TOKEN || "";
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
            return new Response(JSON.stringify({ error: `Group ${upperCode} not found` }), {
              status: 404,
              headers: responseHeaders,
            });
          }
        }

        return new Response(
          JSON.stringify({
            groupCode: upperCode,
            syncUrl: groupDbUrl,
            authToken: groupDbToken,
          }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    // POST /api/global/search — Workers AI embedding + Turso vector search, LIKE fallback
    if (request.method === "POST" && url.pathname === "/api/global/search") {
      try {
        const body = await request.json() as any;
        const queryText: string = (body.query || body.q || "").trim();
        const categoryFilter: string = (body.category || "").trim();
        const limit: number = Math.min(Number(body.limit) || 20, 50);

        if (!queryText) {
          if (categoryFilter) {
            const tursoUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
            const tursoToken = env.TURSO_AUTH_TOKEN || "";
            const sql = "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND type = ? LIMIT ?";
            const result = await queryTurso(tursoUrl, tursoToken, sql, [categoryFilter, limit]);
            let matters: any[] = [];
            if (result?.rows) {
              const cols = result.cols.map((c: any) => c.name || c);
              for (const row of result.rows) {
                const obj: any = {};
                row.forEach((cell: any, i: number) => {
                  obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
                });
                matters.push(obj);
              }
            }
            let massRecords: any[] = [];
            if (matters.length > 0) {
              const ids = matters.map((m) => m.id);
              const ph = ids.map(() => "?").join(",");
              const massResult = await queryTurso(
                tursoUrl, tursoToken,
                `SELECT id, matter, type, qty, value, active, data FROM mass WHERE matter IN (${ph}) AND active = 1`,
                ids
              );
              if (massResult?.rows) {
                const cols = massResult.cols.map((c: any) => c.name || c);
                for (const row of massResult.rows) {
                  const obj: any = {};
                  row.forEach((cell: any, i: number) => {
                    obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
                  });
                  massRecords.push(obj);
                }
              }
            }
            return new Response(
              JSON.stringify({ matters, mass: massRecords, vectorUsed: false }),
              { status: 200, headers: responseHeaders }
            );
          } else {
            return new Response(JSON.stringify({ matters: [], mass: [] }), {
              status: 200,
              headers: responseHeaders,
            });
          }
        }

        const tursoUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        const tursoToken = env.TURSO_AUTH_TOKEN || "";
        let matters: any[] = [];
        let usedVector = false;

        // ── Strategy 1: Workers AI embedding + vector_distance_cos ────────────
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
              if (result?.rows?.length > 0) {
                const cols = result.cols.map((c: any) => c.name || c);
                for (const row of result.rows) {
                  const obj: any = {};
                  row.forEach((cell: any, i: number) => {
                    obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
                  });
                  matters.push(obj);
                }
                usedVector = true;
              }
            }
          } catch (aiErr) {
            console.warn("[Search] AI vector search failed, falling back:", aiErr);
          }
        }

        // ── Strategy 2: LIKE text search fallback ─────────────────────────────
        if (!usedVector) {
          const term = `%${queryText}%`;
          const likeSql = categoryFilter
            ? "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND type = ? AND (title LIKE ? OR data LIKE ?) LIMIT ?"
            : "SELECT id, code, type, scope, title, data, time FROM matter WHERE public = 1 AND scope = 'g' AND (title LIKE ? OR data LIKE ?) LIMIT ?";
          const likeParams = categoryFilter
            ? [categoryFilter, term, term, limit]
            : [term, term, limit];
          const result = await queryTurso(tursoUrl, tursoToken, likeSql, likeParams);
          if (result?.rows) {
            const cols = result.cols.map((c: any) => c.name || c);
            for (const row of result.rows) {
              const obj: any = {};
              row.forEach((cell: any, i: number) => {
                obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
              });
              matters.push(obj);
            }
          }
        }

        // ── Fetch active mass rows for matched matters ─────────────────────────
        let massRecords: any[] = [];
        if (matters.length > 0) {
          const ids = matters.map((m) => m.id);
          const ph = ids.map(() => "?").join(",");
          const massResult = await queryTurso(
            tursoUrl, tursoToken,
            `SELECT id, matter, type, qty, value, active, data FROM mass WHERE matter IN (${ph}) AND active = 1`,
            ids
          );
          if (massResult?.rows) {
            const cols = massResult.cols.map((c: any) => c.name || c);
            for (const row of massResult.rows) {
              const obj: any = {};
              row.forEach((cell: any, i: number) => {
                obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
              });
              massRecords.push(obj);
            }
          }
        }

        return new Response(
          JSON.stringify({ matters, mass: massRecords, vectorUsed: usedVector }),
          { status: 200, headers: responseHeaders }
        );
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }


    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: responseHeaders,
    });
  },
};

