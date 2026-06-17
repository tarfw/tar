import { DO_SCHEMA } from "./do-schema";
import { verifyJwt } from "./auth";

export class TarDO {
  private state: DurableObjectState;
  private env: Env;
  private sql: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    await this.ensureSchema();

    // WebSocket upgrade via ws=1 query param (Upgrade header gets stripped by new Request())
    if (url.searchParams.get("ws") === "1") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/api/sync") {
      return this.handleSync(request);
    }
    if (url.pathname === "/api/query") {
      return this.handleQuery(request);
    }
    if (url.pathname === "/kick") {
      return this.handleKick(request);
    }
    if (url.pathname === "/api/heartbeat") {
      return this.handleHeartbeat();
    }

    return new Response("Not Found", { status: 404 });
  }

  private async ensureSchema(): Promise<void> {
    try {
      const tables = this.sql.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='form'"
      ).toArray();

      if (tables.length === 0) {
        const statements = DO_SCHEMA.split(";").filter(s => s.trim());
        for (const stmt of statements) {
          this.sql.exec(stmt);
        }
      }
    } catch (e) {
      console.error("[DO] Schema init error:", e);
    }
  }

  async handleSync(request: Request): Promise<Response> {
    try {
      const body = await request.json();

      // client-init: return changes since last sync
      if (body.type === "client-init" || body.last_synced_seq !== undefined) {
        const last_synced_seq = body.last_synced_seq || 0;
        const last_synced_time = body.last_synced_time || "1970-01-01T00:00:00.000Z";

        const motion = this.sql.exec(
          "SELECT * FROM motion WHERE seq > ? ORDER BY seq ASC LIMIT 1000",
          [last_synced_seq]
        ).toArray();

        const form = this.sql.exec(
          "SELECT * FROM form WHERE time > ? ORDER BY time ASC LIMIT 500",
          [last_synced_time]
        ).toArray();

        const matter = this.sql.exec(
          "SELECT * FROM matter WHERE time > ? ORDER BY time ASC LIMIT 500",
          [last_synced_time]
        ).toArray();

        const bond = this.sql.exec(
          "SELECT * FROM bond WHERE time > ? ORDER BY time ASC LIMIT 500",
          [last_synced_time]
        ).toArray();

        return Response.json({ motion, form, matter, bond });
      }

      // client-sync: upsert rows from client
      const { motion = [], form = [], matter = [], bond = [] } = body;
      let count = 0;

      for (const row of motion) {
        try {
          this.sql.exec(
            "INSERT OR REPLACE INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [row.stream, row.seq, row.action, row.phase, row.delta, row.client_ref, row.data, row.time || new Date().toISOString()]
          );
          count++;
        } catch (e) { console.error("[DO] Motion insert error:", e); }
      }

      for (const row of form) {
        try {
          this.sql.exec(
            `INSERT INTO form (id, code, type, scope, owner, title, public, active, data, time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = CASE WHEN excluded.time > form.time THEN excluded.title ELSE form.title END,
               active = CASE WHEN excluded.time > form.time THEN excluded.active ELSE form.active END,
               data = CASE WHEN excluded.time > form.time THEN excluded.data ELSE form.data END,
               time = CASE WHEN excluded.time > form.time THEN excluded.time ELSE form.time END`,
            [row.id, row.code, row.type, row.scope, row.owner, row.title, row.public, row.active, row.data, row.time || new Date().toISOString()]
          );
          count++;
        } catch (e) { console.error("[DO] Form upsert error:", e); }
      }

      for (const row of matter) {
        try {
          this.sql.exec(
            `INSERT INTO matter (id, form, type, scope, qty, value, active, variant, mark, geo, start, end, data, time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               qty = CASE WHEN excluded.time > matter.time THEN excluded.qty ELSE matter.qty END,
               value = CASE WHEN excluded.time > matter.time THEN excluded.value ELSE matter.value END,
               active = CASE WHEN excluded.time > matter.time THEN excluded.active ELSE matter.active END,
               data = CASE WHEN excluded.time > matter.time THEN excluded.data ELSE matter.data END,
               time = CASE WHEN excluded.time > matter.time THEN excluded.time ELSE matter.time END`,
            [row.id, row.form, row.type, row.scope, row.qty, row.value, row.active, row.variant, row.mark, row.geo, row.start, row.end, row.data, row.time || new Date().toISOString()]
          );
          count++;
        } catch (e) { console.error("[DO] Matter upsert error:", e); }
      }

      for (const row of bond) {
        try {
          this.sql.exec(
            `INSERT INTO bond (src, tgt, type, weight, active, time)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(src, tgt, type) DO UPDATE SET
               weight = CASE WHEN excluded.time > bond.time THEN excluded.weight ELSE bond.weight END,
               active = CASE WHEN excluded.time > bond.time THEN excluded.active ELSE bond.active END,
               time = CASE WHEN excluded.time > bond.time THEN excluded.time ELSE bond.time END`,
            [row.src, row.tgt, row.type, row.weight, row.active, row.time || new Date().toISOString()]
          );
          count++;
        } catch (e) { console.error("[DO] Bond upsert error:", e); }
      }

      return Response.json({ count });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  async handleQuery(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { sql, params = [] } = body;

      if (!sql.trim().toUpperCase().startsWith("SELECT")) {
        return Response.json({ error: "Only SELECT queries allowed" }, { status: 403 });
      }

      const result = this.sql.exec(sql, params).toArray();
      return Response.json({ rows: result });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  async handleKick(request: Request): Promise<Response> {
    try {
      const { userId } = await request.json();

      // Find and close this user's WebSocket(s)
      const webSockets = this.state.getWebSockets(`user:${userId}`);
      let closed = 0;
      for (const ws of webSockets) {
        try {
          ws.close(4001, "kicked by admin");
          closed++;
        } catch (e) {
          console.error(`[DO] Failed to close WS for ${userId}:`, e);
        }
      }

      console.log(`[DO] Kicked user ${userId}, closed ${closed} connection(s)`);
      return Response.json({ success: true, closed });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  async handleHeartbeat(): Promise<Response> {
    return Response.json({ status: "ok", timestamp: Date.now() });
  }

  // WebSocket handlers
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));

      if (data.type === "client-init") {
        await this.handleClientInit(ws, data);
      } else if (data.type === "client-sync") {
        await this.handleClientSync(ws, data);
      }
    } catch (e: any) {
      console.error("[DO] WebSocket message error:", e);
      ws.send(JSON.stringify({ type: "error", message: e.message }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const userId = (ws as any)._userId || "unknown";
    console.log(`[DO] WebSocket closed: ${code} ${reason} (user: ${userId})`);
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    console.error("[DO] WebSocket error:", error);
  }

  private async handleClientInit(ws: WebSocket, data: any): Promise<void> {
    const { last_synced_seq = 0, last_synced_time = "1970-01-01T00:00:00.000Z" } = data;

    const motion = this.sql.exec(
      "SELECT * FROM motion WHERE seq > ? ORDER BY seq ASC LIMIT 1000",
      [last_synced_seq]
    ).toArray();

    const form = this.sql.exec(
      "SELECT * FROM form WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).toArray();

    const matter = this.sql.exec(
      "SELECT * FROM matter WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).toArray();

    const bond = this.sql.exec(
      "SELECT * FROM bond WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).toArray();

    ws.send(JSON.stringify({
      type: "server-sync",
      motion,
      form,
      matter,
      bond
    }));
  }

  private async handleClientSync(ws: WebSocket, data: any): Promise<void> {
    const { motion = [], form = [], matter = [], bond = [] } = data;

    for (const row of motion) {
      try {
        this.sql.exec(
          "INSERT OR REPLACE INTO motion (stream, seq, action, phase, delta, client_ref, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [row.stream, row.seq, row.action, row.phase, row.delta, row.client_ref, row.data, row.time || new Date().toISOString()]
        );
      } catch (e) {
        console.error("[DO] Motion insert error:", e);
      }
    }

    for (const row of form) {
      try {
        this.sql.exec(
          `INSERT INTO form (id, code, type, scope, owner, title, public, active, data, time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = CASE WHEN excluded.time > form.time THEN excluded.title ELSE form.title END,
             active = CASE WHEN excluded.time > form.time THEN excluded.active ELSE form.active END,
             data = CASE WHEN excluded.time > form.time THEN excluded.data ELSE form.data END,
             time = CASE WHEN excluded.time > form.time THEN excluded.time ELSE form.time END`,
          [row.id, row.code, row.type, row.scope, row.owner, row.title, row.public, row.active, row.data, row.time || new Date().toISOString()]
        );
      } catch (e) {
        console.error("[DO] Form upsert error:", e);
      }
    }

    for (const row of matter) {
      try {
        this.sql.exec(
          `INSERT INTO matter (id, form, type, scope, qty, value, active, variant, mark, geo, start, end, data, time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             qty = CASE WHEN excluded.time > matter.time THEN excluded.qty ELSE matter.qty END,
             value = CASE WHEN excluded.time > matter.time THEN excluded.value ELSE matter.value END,
             active = CASE WHEN excluded.time > matter.time THEN excluded.active ELSE matter.active END,
             data = CASE WHEN excluded.time > matter.time THEN excluded.data ELSE matter.data END,
             time = CASE WHEN excluded.time > matter.time THEN excluded.time ELSE matter.time END`,
          [row.id, row.form, row.type, row.scope, row.qty, row.value, row.active, row.variant, row.mark, row.geo, row.start, row.end, row.data, row.time || new Date().toISOString()]
        );
      } catch (e) {
        console.error("[DO] Matter upsert error:", e);
      }
    }

    for (const row of bond) {
      try {
        this.sql.exec(
          `INSERT INTO bond (src, tgt, type, weight, active, time)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(src, tgt, type) DO UPDATE SET
             weight = CASE WHEN excluded.time > bond.time THEN excluded.weight ELSE bond.weight END,
             active = CASE WHEN excluded.time > bond.time THEN excluded.active ELSE bond.active END,
             time = CASE WHEN excluded.time > bond.time THEN excluded.time ELSE bond.time END`,
          [row.src, row.tgt, row.type, row.weight, row.active, row.time || new Date().toISOString()]
        );
      } catch (e) {
        console.error("[DO] Bond upsert error:", e);
      }
    }

    ws.send(JSON.stringify({
      type: "client-sync-ack",
      count: motion.length + form.length + matter.length + bond.length
    }));

    const webSockets = this.state.getWebSockets();
    for (const otherWs of webSockets) {
      if (otherWs !== ws) {
        otherWs.send(JSON.stringify({
          type: "broadcast",
          motion,
          form,
          matter,
          bond
        }));
      }
    }
  }
}
