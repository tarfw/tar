/**
 * Action catalog — trusted handlers for user actions.
 * AI references actions by ID only; it never writes handlers.
 */

import { z } from 'zod';
import type { ActionCatalogEntry } from './types';

// ── Action implementations ──────────────────────────────────────────

const createOrder: ActionCatalogEntry = {
  id: 'action_create_order',
  label: 'Create Order',
  description: 'Create a new order record',
  params: z.object({
    customer_name: z.string().min(1),
    items: z.string(),
    total: z.number().min(0),
  }),
  execute: async (params, scope, env) => {
    const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await env.DB.prepare(
      `INSERT INTO matter (id, type, scope, title, value, data, active) 
       VALUES (?, 'order', ?, ?, ?, ?, 1)`
    )
      .bind(
        orderId,
        scope,
        `Order for ${params.customer_name}`,
        params.total,
        JSON.stringify({
          customer: params.customer_name,
          items: params.items,
          total: params.total,
          status: 'pending',
          createdAt: new Date().toISOString(),
        })
      )
      .run();
    return { success: true, id: orderId };
  },
};

const recordSale: ActionCatalogEntry = {
  id: 'action_record_sale',
  label: 'Record Sale',
  description: 'Mark an order as completed/sold',
  params: z.object({
    order_id: z.string().min(1),
    amount: z.number().min(0).optional(),
  }),
  execute: async (params, scope, env) => {
    await env.DB.prepare(
      `UPDATE matter SET data = json_set(data, '$.status', 'completed', '$.completedAt', ?)
       WHERE id = ? AND type = 'order' AND scope = ?`
    )
      .bind(new Date().toISOString(), params.order_id, scope)
      .run();
    return { success: true, orderId: params.order_id };
  },
};

const updateInventory: ActionCatalogEntry = {
  id: 'action_update_inventory',
  label: 'Update Inventory',
  description: 'Update product quantity or details',
  params: z.object({
    product_id: z.string().min(1),
    qty: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
  }),
  execute: async (params, scope, env) => {
    if (params.qty !== undefined) {
      await env.DB.prepare(
        `UPDATE matter SET qty = ? WHERE id = ? AND scope = ?`
      )
        .bind(params.qty, params.product_id, scope)
        .run();
    }
    if (params.price !== undefined) {
      await env.DB.prepare(
        `UPDATE matter SET value = ? WHERE id = ? AND scope = ?`
      )
        .bind(params.price, params.product_id, scope)
        .run();
    }
    return { success: true, productId: params.product_id };
  },
};

const createBooking: ActionCatalogEntry = {
  id: 'action_create_booking',
  label: 'Create Booking',
  description: 'Create a new appointment booking',
  params: z.object({
    customer_name: z.string().min(1),
    service: z.string().min(1),
    date: z.string().min(1),
    slot: z.string().min(1),
  }),
  execute: async (params, scope, env) => {
    const bookingId = `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await env.DB.prepare(
      `INSERT INTO matter (id, type, scope, title, data, active) 
       VALUES (?, 'booking', ?, ?, ?, 1)`
    )
      .bind(
        bookingId,
        scope,
        `Booking for ${params.customer_name}`,
        JSON.stringify({
          customer: params.customer_name,
          service: params.service,
          date: params.date,
          slot: params.slot,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        })
      )
      .run();
    return { success: true, id: bookingId };
  },
};

const createProduct: ActionCatalogEntry = {
  id: 'action_create_product',
  label: 'Create Product',
  description: 'Add a new product to inventory',
  params: z.object({
    title: z.string().min(1),
    price: z.number().min(0),
    qty: z.number().min(0).optional(),
    category: z.string().optional(),
  }),
  execute: async (params, scope, env) => {
    const productId = `prd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await env.DB.prepare(
      `INSERT INTO matter (id, type, scope, title, value, qty, data, active) 
       VALUES (?, 'product', ?, ?, ?, ?, ?, 1)`
    )
      .bind(
        productId,
        scope,
        params.title,
        params.price,
        params.qty || 10,
        JSON.stringify({
          category: params.category || 'General',
          createdAt: new Date().toISOString(),
        })
      )
      .run();
    return { success: true, id: productId };
  },
};

// ── Action catalog ──────────────────────────────────────────────────

export const ACTION_CATALOG: ActionCatalogEntry[] = [
  createOrder,
  recordSale,
  updateInventory,
  createBooking,
  createProduct,
];

// ── Lookup helpers ──────────────────────────────────────────────────

export function getActionEntry(id: string): ActionCatalogEntry | undefined {
  return ACTION_CATALOG.find((a) => a.id === id);
}

export function getActionIds(): string[] {
  return ACTION_CATALOG.map((a) => a.id);
}

export function isValidAction(id: string): boolean {
  return ACTION_CATALOG.some((a) => a.id === id);
}

export async function executeAction(
  actionId: string,
  params: any,
  scope: string,
  env: any
): Promise<any> {
  const entry = getActionEntry(actionId);
  if (!entry) throw new Error(`Unknown action: ${actionId}`);
  const validated = entry.params.safeParse(params);
  if (!validated.success) throw new Error(`Invalid params: ${validated.error.message}`);
  return entry.execute(validated.data, scope, env);
}
