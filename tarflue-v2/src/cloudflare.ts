import { DurableObject } from 'cloudflare:workers';

export interface Env {
  STOREFRONT_CACHE: KVNamespace;
  EDITOR: DurableObjectNamespace;
  WORKSPACE_DO: DurableObjectNamespace;
  ORDER_DO: DurableObjectNamespace;
}

interface CartItem {
  name: string;
  price: number | null;
  qty: number;
}

interface Reservation {
  id: string;
  items: CartItem[];
  committed: boolean;
  expiresAt: number;
}

/**
 * WorkspaceDO — Per-workspace stock, services, config (matter only).
 * Renamed from StorefrontDO. Scope prefix: w:
 */
export class WorkspaceDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/stock' && request.method === 'GET') {
      const allKeys = await this.ctx.storage.list();
      const stock: Record<string, number> = {};
      for (const [key, value] of allKeys.entries()) {
        if (key.startsWith('stock:')) {
          stock[key.replace('stock:', '')] = value as number;
        }
      }
      return new Response(JSON.stringify(stock), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/stock/update' && request.method === 'POST') {
      const body = await request.json() as { stock: Record<string, number> };
      if (!body?.stock) return new Response('Bad request', { status: 400 });
      for (const [productName, qty] of Object.entries(body.stock)) {
        await this.ctx.storage.put(`stock:${productName}`, qty);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/reserve' && request.method === 'POST') {
      const body = await request.json() as { items: CartItem[] };
      if (!body?.items) return new Response('Bad request', { status: 400 });

      const reservationId = 'res_' + Math.random().toString(36).substring(2, 10);
      const itemsToReserve: CartItem[] = [];

      for (const item of body.items) {
        const stockKey = `stock:${item.name}`;
        const currentStock = (await this.ctx.storage.get<number>(stockKey)) ?? 0;
        if (currentStock < item.qty) {
          return new Response(JSON.stringify({ error: `Insufficient stock for ${item.name}. Available: ${currentStock}` }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }
        itemsToReserve.push(item);
      }

      for (const item of itemsToReserve) {
        const stockKey = `stock:${item.name}`;
        const currentStock = (await this.ctx.storage.get<number>(stockKey)) ?? 0;
        await this.ctx.storage.put(stockKey, currentStock - item.qty);
      }

      const expiresAt = Date.now() + 10 * 60 * 1000;
      const reservation: Reservation = { id: reservationId, items: itemsToReserve, committed: false, expiresAt };
      await this.ctx.storage.put(`res:${reservationId}`, reservation);

      return new Response(JSON.stringify({ ok: true, reservationId, expiresAt }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/commit' && request.method === 'POST') {
      const body = await request.json() as { reservationId: string };
      if (!body?.reservationId) return new Response('Bad request', { status: 400 });
      const resKey = `res:${body.reservationId}`;
      const reservation = await this.ctx.storage.get<Reservation>(resKey);
      if (!reservation) return new Response('Reservation not found', { status: 404 });
      reservation.committed = true;
      await this.ctx.storage.put(resKey, reservation);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (path === '/release' && request.method === 'POST') {
      const body = await request.json() as { reservationId: string };
      if (!body?.reservationId) return new Response('Bad request', { status: 400 });
      const resKey = `res:${body.reservationId}`;
      const reservation = await this.ctx.storage.get<Reservation>(resKey);
      if (!reservation) return new Response('Reservation not found or already released', { status: 404 });
      if (!reservation.committed) {
        for (const item of reservation.items) {
          const stockKey = `stock:${item.name}`;
          const currentStock = (await this.ctx.storage.get<number>(stockKey)) ?? 0;
          await this.ctx.storage.put(stockKey, currentStock + item.qty);
        }
      }
      await this.ctx.storage.delete(resKey);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
}

/**
 * OrderDO — Per-order state machine + payment for complex orders.
 * State machine: created → confirmed → preparing → dispatched → delivered → cancelled
 */
export class OrderDO extends DurableObject<Env> {
  // Valid state transitions
  private static TRANSITIONS: Record<string, string[]> = {
    'created': ['confirmed', 'cancelled'],
    'confirmed': ['preparing', 'cancelled'],
    'preparing': ['dispatched', 'cancelled'],
    'dispatched': ['delivered', 'cancelled'],
    'delivered': [],
    'cancelled': [],
  };

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /create — create new order
    if (path === '/create' && request.method === 'POST') {
      const body = await request.json() as {
        storeSlug: string;
        items: CartItem[];
        email: string;
        customerName?: string;
        address?: string;
      };
      if (!body?.storeSlug || !body?.items) return new Response('Bad request', { status: 400 });

      // Reserve stock in WorkspaceDO
      const workspaceId = this.env.WORKSPACE_DO.idFromName(body.storeSlug);
      const workspaceDO = this.env.WORKSPACE_DO.get(workspaceId);
      const res = await workspaceDO.fetch('https://do/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: body.items }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return new Response(errBody, { status: res.status, headers: { 'Content-Type': 'application/json' } });
      }
      const { reservationId, expiresAt } = await res.json() as { reservationId: string; expiresAt: number };

      const orderData = {
        id: this.ctx.id.toString(),
        storeSlug: body.storeSlug,
        items: body.items,
        email: body.email,
        customerName: body.customerName || '',
        address: body.address || '',
        reservationId,
        status: 'created',
        payment: null,
        statusHistory: [{ status: 'created', time: Date.now() }],
        createdAt: Date.now(),
        expiresAt,
      };
      await this.ctx.storage.put('data', orderData);
      await this.ctx.storage.setAlarm(expiresAt);
      return new Response(JSON.stringify(orderData), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /transition — advance order state
    if (path === '/transition' && request.method === 'POST') {
      const body = await request.json() as { status: string; note?: string };
      const orderData = await this.ctx.storage.get<any>('data');
      if (!orderData) return new Response('Order not found', { status: 404 });

      const validNext = OrderDO.TRANSITIONS[orderData.status] || [];
      if (!validNext.includes(body.status)) {
        return new Response(JSON.stringify({
          error: `Cannot transition from ${orderData.status} to ${body.status}`,
          validTransitions: validNext,
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      orderData.status = body.status;
      orderData.statusHistory.push({ status: body.status, time: Date.now(), note: body.note });

      // On delivery: commit stock, release alarm
      if (body.status === 'delivered') {
        const workspaceId = this.env.WORKSPACE_DO.idFromName(orderData.storeSlug);
        const workspaceDO = this.env.WORKSPACE_DO.get(workspaceId);
        await workspaceDO.fetch('https://do/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: orderData.reservationId }),
        });
        await this.ctx.storage.deleteAlarm();
      }

      // On cancellation: release stock
      if (body.status === 'cancelled') {
        const workspaceId = this.env.WORKSPACE_DO.idFromName(orderData.storeSlug);
        const workspaceDO = this.env.WORKSPACE_DO.get(workspaceId);
        await workspaceDO.fetch('https://do/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: orderData.reservationId }),
        });
        await this.ctx.storage.deleteAlarm();
      }

      await this.ctx.storage.put('data', orderData);
      return new Response(JSON.stringify(orderData), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /pay — record payment
    if (path === '/pay' && request.method === 'POST') {
      const body = await request.json() as { method: string; amount: number; txnId?: string };
      const orderData = await this.ctx.storage.get<any>('data');
      if (!orderData) return new Response('Order not found', { status: 404 });

      orderData.payment = {
        method: body.method,
        amount: body.amount,
        txnId: body.txnId || '',
        paidAt: Date.now(),
      };
      orderData.statusHistory.push({ status: 'paid', time: Date.now() });

      await this.ctx.storage.put('data', orderData);
      return new Response(JSON.stringify(orderData), { headers: { 'Content-Type': 'application/json' } });
    }

    // GET /status — get order status
    if (path === '/status' && request.method === 'GET') {
      const orderData = await this.ctx.storage.get<any>('data');
      if (!orderData) return new Response('Order not found', { status: 404 });
      return new Response(JSON.stringify(orderData), { headers: { 'Content-Type': 'application/json' } });
    }

    // GET /history — get status history
    if (path === '/history' && request.method === 'GET') {
      const orderData = await this.ctx.storage.get<any>('data');
      if (!orderData) return new Response('Order not found', { status: 404 });
      return new Response(JSON.stringify({ history: orderData.statusHistory }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }

  // Alarm: auto-cancel if payment not received
  async alarm(): Promise<void> {
    const orderData = await this.ctx.storage.get<any>('data');
    if (!orderData) return;
    if (orderData.status !== 'delivered' && orderData.status !== 'cancelled') {
      const workspaceId = this.env.WORKSPACE_DO.idFromName(orderData.storeSlug);
      const workspaceDO = this.env.WORKSPACE_DO.get(workspaceId);
      await workspaceDO.fetch('https://do/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: orderData.reservationId }),
      });
      orderData.status = 'cancelled';
      orderData.statusHistory.push({ status: 'cancelled', time: Date.now(), note: 'Auto-cancelled: timeout' });
      await this.ctx.storage.put('data', orderData);
    }
  }
}

/**
 * EditorDO — Live-preview relay for desktop editors.
 */
export class EditorDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      const html = await this.ctx.storage.get<string>('html');
      if (html) { server.send(JSON.stringify({ type: 'render', html })); } else { server.send(JSON.stringify({ type: 'empty' })); }
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/push' && request.method === 'POST') {
      const html = await request.text();
      await this.ctx.storage.put('html', html);
      const payload = JSON.stringify({ type: 'render', html });
      for (const ws of this.ctx.getWebSockets()) { try { ws.send(payload); } catch {} }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (text === 'ping' || text === '{"type":"ping"}') { ws.send(JSON.stringify({ type: 'pong' })); }
  }
}
