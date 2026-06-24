/**
 * EditorDO — live-preview relay (one per store, keyed by subdomain).
 *
 * The phone app is the only writer: it POSTs a rendered layout to the Worker,
 * which renders HTML and pushes it here via /push. This DO stores the latest
 * HTML and broadcasts it to every connected desktop editor over WebSocket.
 *
 * Desktop editors are read-only viewers — they connect on /ws, receive the
 * current HTML immediately, and get a fresh render on every phone edit.
 *
 * Hibernatable WebSockets → ~$0 when no desktop is watching.
 */

import { DurableObject } from 'cloudflare:workers';

export class EditorDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Desktop editor connects here.
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.ctx.acceptWebSocket(server);

      const html = await this.ctx.storage.get<string>('html');
      if (html) {
        server.send(JSON.stringify({ type: 'render', html }));
      } else {
        server.send(JSON.stringify({ type: 'empty' }));
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // Phone → Worker → here: store + broadcast rendered HTML.
    if (url.pathname === '/push' && request.method === 'POST') {
      const html = await request.text();
      await this.ctx.storage.put('html', html);

      const payload = JSON.stringify({ type: 'render', html });
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {
          // Socket gone; hibernation API will clean it up.
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text === 'ping' || text === '{"type":"ping"}') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  async webSocketClose(): Promise<void> {
    // No-op: hibernation manages the socket set.
  }
}
