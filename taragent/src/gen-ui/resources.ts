/**
 * Resource catalog — trusted resolvers for live data.
 * AI references resources by ID only; it never writes queries.
 */

import type { ResourceCatalogEntry } from './types';

// ── Resource implementations ────────────────────────────────────────

const ordersSummary: ResourceCatalogEntry = {
  id: 'orders.summary',
  label: 'Orders Summary',
  description: 'Total orders count, today orders, revenue',
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT COUNT(*) as total, 
                SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today,
                COALESCE(SUM(CASE WHEN data LIKE '%status%completed%' THEN CAST(json_extract(data, '$.total') AS REAL) ELSE 0 END), 0) as revenue
         FROM matter WHERE type = 'order' AND scope = ? AND active = 1`
      )
        .bind(scope)
        .first();
      return {
        total: result?.total || 0,
        today: result?.today || 0,
        revenue: result?.revenue || 0,
      };
    } catch {
      return { total: 0, today: 0, revenue: 0 };
    }
  },
};

const ordersList: ResourceCatalogEntry = {
  id: 'orders.list',
  label: 'Orders List',
  description: 'List of recent orders',
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT id, title, value, data, created_at FROM matter 
         WHERE type = 'order' AND scope = ? AND active = 1 
         ORDER BY created_at DESC LIMIT 50`
      )
        .bind(scope)
        .all();
      return (result.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        value: r.value,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  },
};

const inventorySummary: ResourceCatalogEntry = {
  id: 'inventory.summary',
  label: 'Inventory Summary',
  description: 'Total products, low stock count, total value',
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN qty < 10 THEN 1 ELSE 0 END) as lowStock,
                COALESCE(SUM(value * qty), 0) as totalValue
         FROM matter WHERE type = 'product' AND scope = ? AND active = 1`
      )
        .bind(scope)
        .first();
      return {
        total: result?.total || 0,
        lowStock: result?.lowStock || 0,
        totalValue: result?.totalValue || 0,
      };
    } catch {
      return { total: 0, lowStock: 0, totalValue: 0 };
    }
  },
};

const inventoryList: ResourceCatalogEntry = {
  id: 'inventory.list',
  label: 'Inventory List',
  description: 'List of all products/inventory items',
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT id, title, value, qty, data FROM matter 
         WHERE type = 'product' AND scope = ? AND active = 1 
         ORDER BY title ASC LIMIT 100`
      )
        .bind(scope)
        .all();
      return (result.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        price: r.value,
        qty: r.qty,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
      }));
    } catch {
      return [];
    }
  },
};

const bookingsToday: ResourceCatalogEntry = {
  id: 'bookings.today',
  label: "Today's Bookings",
  description: "Today's appointments or bookings",
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT id, title, data, created_at FROM matter 
         WHERE type = 'booking' AND scope = ? AND active = 1 
         AND json_extract(data, '$.date') = date('now')
         ORDER BY created_at ASC`
      )
        .bind(scope)
        .all();
      return (result.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  },
};

const siteCatalog: ResourceCatalogEntry = {
  id: 'site.catalog',
  label: 'Site Catalog',
  description: 'Products for public site display',
  resolve: async (scope: string, env: any) => {
    try {
      const result = await env.DB.prepare(
        `SELECT id, title, value, data FROM matter 
         WHERE type = 'product' AND scope = ? AND active = 1 
         ORDER BY title ASC LIMIT 50`
      )
        .bind(scope)
        .all();
      return (result.results || []).map((r: any) => ({
        id: r.id,
        name: r.title,
        price: r.value,
        description: r.data?.description || '',
        imageUrl: r.data?.imageUrl || '',
        tags: r.data?.tags || [],
      }));
    } catch {
      return [];
    }
  },
};

// ── Resource catalog ────────────────────────────────────────────────

export const RESOURCE_CATALOG: ResourceCatalogEntry[] = [
  ordersSummary,
  ordersList,
  inventorySummary,
  inventoryList,
  bookingsToday,
  siteCatalog,
];

// ── Lookup helpers ──────────────────────────────────────────────────

export function getResourceEntry(id: string): ResourceCatalogEntry | undefined {
  return RESOURCE_CATALOG.find((r) => r.id === id);
}

export function getResourceIds(): string[] {
  return RESOURCE_CATALOG.map((r) => r.id);
}

export function isValidResource(id: string): boolean {
  return RESOURCE_CATALOG.some((r) => r.id === id);
}

export async function resolveResource(
  resourceId: string,
  scope: string,
  env: any
): Promise<any> {
  const entry = getResourceEntry(resourceId);
  if (!entry) return null;
  return entry.resolve(scope, env);
}
