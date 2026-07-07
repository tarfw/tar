import { DurableObject } from 'cloudflare:workers';

export interface Env {
  STOREFRONT_CACHE: KVNamespace;
  EDITOR: DurableObjectNamespace;
}

/**
 * Editor — Stateless live-preview WebSocket relay for desktop editors.
 */
export class Editor extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'ready' }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/push' && request.method === 'POST') {
      const html = await request.text();
      const payload = JSON.stringify({ type: 'render', html });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {}
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text === 'ping' || text === '{"type":"ping"}') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }
}
