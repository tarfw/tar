import { DO_SCHEMA } from "./do-schema";

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

    // Initialize schema if needed
    await this.ensureSchema();

    // Route to handlers
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
      // Check if schema exists
      const tables = this.sql.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='form'"
      ).all();
      
      if (tables.length === 0) {
        // Apply schema
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
      const { last_synced_seq = 0, last_synced_time = "1970-01-01T00:00:00.000Z" } = body;

      // Get changes since last sync
      const motion = this.sql.exec(
        "SELECT * FROM motion WHERE seq > ? ORDER BY seq ASC LIMIT 1000",
        [last_synced_seq]
      ).all();

      const form = this.sql.exec(
        "SELECT * FROM form WHERE time > ? ORDER BY time ASC LIMIT 500",
        [last_synced_time]
      ).all();

      const matter = this.sql.exec(
        "SELECT * FROM matter WHERE time > ? ORDER BY time ASC LIMIT 500",
        [last_synced_time]
      ).all();

      const bond = this.sql.exec(
        "SELECT * FROM bond WHERE time > ? ORDER BY time ASC LIMIT 500",
        [last_synced_time]
      ).all();

      return Response.json({ motion, form, matter, bond });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  async handleQuery(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { sql, params = [] } = body;

      // Only allow read queries
      if (!sql.trim().toUpperCase().startsWith("SELECT")) {
        return Response.json({ error: "Only SELECT queries allowed" }, { status: 403 });
      }

      const result = this.sql.exec(sql, params).all();
      return Response.json({ rows: result });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  async handleKick(request: Request): Promise<Response> {
    try {
      const { userId } = await request.json();
      
      // Close WebSocket for this user
      const webSockets = this.state.getWebSockets();
      for (const ws of webSockets) {
        // In a real implementation, you'd track userId per WebSocket
        // For now, we'll just log the kick request
        console.log(`[DO] Kick requested for user: ${userId}`);
      }

      return Response.json({ success: true });
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
    console.log(`[DO] WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: any): Promise<void> {
    console.error("[DO] WebSocket error:", error);
  }

  private async handleClientInit(ws: WebSocket, data: any): Promise<void> {
    const { last_synced_seq = 0, last_synced_time = "1970-01-01T00:00:00.000Z" } = data;

    // Get changes since last sync
    const motion = this.sql.exec(
      "SELECT * FROM motion WHERE seq > ? ORDER BY seq ASC LIMIT 1000",
      [last_synced_seq]
    ).all();

    const form = this.sql.exec(
      "SELECT * FROM form WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).all();

    const matter = this.sql.exec(
      "SELECT * FROM matter WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).all();

    const bond = this.sql.exec(
      "SELECT * FROM bond WHERE time > ? ORDER BY time ASC LIMIT 500",
      [last_synced_time]
    ).all();

    // Send server-sync to client
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

    // Insert motion rows
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

    // Insert/update form rows (LWW)
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

    // Insert/update matter rows (LWW)
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

    // Insert/update bond rows (LWW)
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

    // Send ack
    ws.send(JSON.stringify({
      type: "client-sync-ack",
      count: motion.length + form.length + matter.length + bond.length
    }));

    // Broadcast to other clients
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
