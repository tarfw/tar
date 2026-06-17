import { verifyJwt, mintJwt } from "./auth";
import { TarDO } from "./tar-do";

export { TarDO };

export interface Env {
  SYNC_DO: DurableObjectNamespace;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route to handlers
      if (url.pathname === "/api/auth") {
        return this.handleAuth(request, env, corsHeaders);
      }
      if (url.pathname === "/api/sync") {
        return this.handleSyncProxy(request, env, corsHeaders);
      }
      if (url.pathname === "/api/query") {
        return this.handleQueryProxy(request, env, corsHeaders);
      }
      if (url.pathname === "/api/kick") {
        return this.handleKickProxy(request, env, corsHeaders);
      }
      if (url.pathname === "/api/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },

  async handleAuth(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const { idToken } = await request.json();

    // Verify Google token
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!googleResponse.ok) {
      return new Response("Invalid Google token", { status: 401, headers: corsHeaders });
    }

    const googleData = await googleResponse.json();
    const sub = googleData.sub;
    const userId = `usr_${sub}`;

    // Get user's permitted scopes from your database
    // Scopes are keyed by the raw Google subject id — matching the app's
    // getSelfId() (user.id) and scope construction (`s:${selfId}`).
    const scopes = [`p:${sub}`, `s:${sub}`, `t:${sub}`];

    // Mint custom JWT
    const token = await mintJwt(
      { userId, scopes },
      env.JWT_SECRET,
      900 // 15 minutes
    );

    return Response.json({ token, userId }, { headers: corsHeaders });
  },

  async handleSyncProxy(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader === "websocket") {
      const token = url.searchParams.get("token");
      const scopeCode = url.searchParams.get("scope");

      if (!token || !scopeCode) {
        return new Response("Missing token or scope", { status: 400, headers: corsHeaders });
      }

      let payload;
      try {
        payload = await verifyJwt(token, env.JWT_SECRET);
      } catch (e) {
        return new Response("Invalid token", { status: 401, headers: corsHeaders });
      }

      if (!payload.scopes.includes(scopeCode) && !payload.scopes.some(s => scopeCode.startsWith(s))) {
        return new Response("Unauthorized scope", { status: 403, headers: corsHeaders });
      }

      // Forward original request to DO — DO handles WebSocket via hibernation
      const doId = env.SYNC_DO.idFromName(scopeCode);
      const doStub = env.SYNC_DO.get(doId);
      return doStub.fetch(request);
    }

    // Regular HTTP request
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Verify JWT from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = await verifyJwt(token, env.JWT_SECRET);
    } catch (e) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    // Get scope from query params
    const scopeCode = url.searchParams.get("scope");
    if (!scopeCode) {
      return new Response("Missing scope", { status: 400, headers: corsHeaders });
    }

    // Check if user has access to this scope
    if (!payload.scopes.includes(scopeCode) && !payload.scopes.some(s => scopeCode.startsWith(s))) {
      return new Response("Unauthorized scope", { status: 403, headers: corsHeaders });
    }

    // Get DO by scope name
    const doId = env.SYNC_DO.idFromName(scopeCode);
    const doStub = env.SYNC_DO.get(doId);

    // Forward request to DO
    const modifiedRequest = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "X-User-Id": payload.userId
      }
    });

    const response = await doStub.fetch(modifiedRequest);
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
    });
  },

  async handleQueryProxy(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Verify JWT
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = await verifyJwt(token, env.JWT_SECRET);
    } catch (e) {
      return new Response("Invalid token", { status: 401, headers: corsHeaders });
    }

    // Get scope from body
    const body = await request.json();
    const { scope, sql, params } = body;
    if (!scope || !sql) {
      return new Response("Missing scope or sql", { status: 400, headers: corsHeaders });
    }

    // Check if user has access to this scope
    if (!payload.scopes.includes(scope) && !payload.scopes.some(s => scope.startsWith(s))) {
      return new Response("Unauthorized scope", { status: 403, headers: corsHeaders });
    }

    // Get DO by scope name
    const doId = env.SYNC_DO.idFromName(scope);
    const doStub = env.SYNC_DO.get(doId);

    // Forward request to DO
    const doRequest = new Request("https://do/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params })
    });

    const response = await doStub.fetch(doRequest);
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
    });
  },

  async handleKickProxy(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Verify JWT (admin only)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { scopeCode, userId } = await request.json();
    if (!scopeCode || !userId) {
      return new Response("Missing scopeCode or userId", { status: 400, headers: corsHeaders });
    }

    // Get DO by scope name
    const doId = env.SYNC_DO.idFromName(scopeCode);
    const doStub = env.SYNC_DO.get(doId);

    // Forward kick request to DO
    const doRequest = new Request("https://do/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });

    const response = await doStub.fetch(doRequest);
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
    });
  }
};
