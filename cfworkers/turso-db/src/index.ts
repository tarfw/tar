import { Env } from "./turso";
import { handlePublish } from "./publish";
import { handleSearch } from "./search";
import { handleGetOrCreateDb } from "./userdb";
import { handleCreateGroup, handleJoinGroup } from "./collab";
import { handleArchive, handleRestore } from "./archive";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    try {
      if (request.method === "POST" && url.pathname === "/api/publish") {
        return await handlePublish(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/global/search") {
        return await handleSearch(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/user/get-or-create-db") {
        return await handleGetOrCreateDb(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/collab/create-group") {
        return await handleCreateGroup(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/collab/join-group") {
        return await handleJoinGroup(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/archive") {
        return await handleArchive(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/restore") {
        return await handleRestore(request, env);
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        return Response.json({ status: "ok" });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
