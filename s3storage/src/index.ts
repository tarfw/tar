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
        const { matter, massRecords } = await request.json() as any;
        if (!matter || !matter.id) {
          return new Response(JSON.stringify({ error: "Missing matter or matter id" }), {
            status: 400,
            headers: responseHeaders,
          });
        }

        const tursoUrl = env.TURSO_URL || "https://tarfw-tarframework.aws-eu-west-1.turso.io";
        const tursoToken = env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzg0MTg5MzAsImlkIjoiMDE5ZTEyMDUtNWUwMS03M2U1LThiZjMtODRjZTUzOWUzZGQ0IiwicmlkIjoiYjQwYzgwYTctNGRlZS00YTE2LTlmM2UtNDAzMmZhYzA3MWU2In0.nuS2C8rqr0WTgWX1DQyysuTbbP0wH_jVOoXDv-zPrXAZ-dKzbMJLmsp7plPjhNFWk57Nhn6ykSuW1KHNFej-DQ";

        const statements: any[] = [];
        
        // 1. Insert or replace published matter in global DB with public = 1
        statements.push({
          q: "INSERT OR REPLACE INTO matter (id, code, type, scope, owner, title, public, data, time) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
          params: [
            matter.id,
            matter.code || null,
            matter.type || null,
            matter.scope || null,
            matter.owner || null,
            matter.title,
            matter.data || null,
            matter.time || new Date().toISOString()
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

    if (request.method === "GET" && url.pathname === "/api/global/search") {
      try {
        const queryParam = url.searchParams.get("q") || "";
        const typeParam = url.searchParams.get("type") || "";
        
        const mainUrl = env.TURSO_URL || "libsql://global-tarframework.aws-eu-west-1.turso.io";
        const mainToken = env.TURSO_AUTH_TOKEN || "";
        
        let sql = "SELECT * FROM matter WHERE public = 1";
        const params: any[] = [];
        
        if (queryParam.trim()) {
          sql += " AND (title LIKE ? OR code LIKE ? OR data LIKE ?)";
          const searchTerm = `%${queryParam}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (typeParam.trim()) {
          sql += " AND type = ?";
          params.push(typeParam);
        }
        
        sql += " LIMIT 25";
        
        const result = await queryTurso(mainUrl, mainToken, sql, params);
        
        const matters: any[] = [];
        if (result && result.rows) {
          const cols = result.cols.map((c: any) => c.name || c);
          for (const row of result.rows) {
            const obj: any = {};
            row.forEach((cell: any, idx: number) => {
              const colName = cols[idx];
              obj[colName] = cell?.value !== undefined ? cell.value : cell;
            });
            matters.push(obj);
          }
        }
        
        let massRecords: any[] = [];
        if (matters.length > 0 && mainToken) {
          const matterIds = matters.map(m => m.id);
          const placeholders = matterIds.map(() => "?").join(",");
          const massSql = `SELECT * FROM mass WHERE matter IN (${placeholders}) AND active = 1`;
          const massResult = await queryTurso(mainUrl, mainToken, massSql, matterIds);
          if (massResult && massResult.rows) {
            const massCols = massResult.cols.map((c: any) => c.name || c);
            for (const row of massResult.rows) {
              const obj: any = {};
              row.forEach((cell: any, idx: number) => {
                const colName = massCols[idx];
                obj[colName] = cell?.value !== undefined ? cell.value : cell;
              });
              massRecords.push(obj);
            }
          }
        }

        return new Response(
          JSON.stringify({ matters, mass: massRecords }),
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

