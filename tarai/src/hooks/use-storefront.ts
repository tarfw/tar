import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';
import {
  DEFAULT_LAYOUT,
  parseLayout,
  type StorefrontLayout,
} from '@/lib/storefront-schema';

interface LayoutRow {
  id: string;
  data: string;
}

let dbRef: any = null;
function getDb() {
  if (!dbRef) {
    // Will be set on first use
    throw new Error('DB not initialized');
  }
  return dbRef;
}

/**
 * Write a row to Turso via HTTP API.
 */
/**
 * Publish layout to the storefront Worker (writes to KV).
 */
async function publishToWorker(subdomain: string, layout: StorefrontLayout): Promise<void> {
  try {
    const res = await fetch(`https://${subdomain}.tarai.space/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, layout }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Storefront] Worker publish failed (${res.status}):`, body.slice(0, 200));
    } else {
      console.log(`[Storefront] Published to Worker: ${subdomain}.tarai.space`);
    }
  } catch (err: any) {
    console.error('[Storefront] Worker publish error:', err?.message);
  }
}

/**
 * Resolve a store's subdomain from its form row.
 */
async function getSubdomain(storeId: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT data FROM form WHERE id = ? AND active = 1',
      storeId
    );
    const subdomain = row ? JSON.parse(row.data || '{}').subdomain : null;
    return subdomain || null;
  } catch {
    return null;
  }
}

/**
 * Mirror the current draft to the desktop live editor (via EditorDO).
 * Fire-and-forget: the Worker renders HTML and broadcasts to connected editors.
 */
async function pushDraftToWorker(storeId: string, layout: StorefrontLayout): Promise<void> {
  const subdomain = await getSubdomain(storeId);
  if (!subdomain) return;
  try {
    await fetch(`https://${subdomain}.tarai.space/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, layout }),
    });
  } catch (err: any) {
    console.error('[Storefront] Draft push error:', err?.message);
  }
}

/**
 * Publish layout to the storefront Worker.
 */
async function syncToTurso(
  storeId: string,
  layout: StorefrontLayout
): Promise<void> {
  try {
    // Get store subdomain from local DB
    const db = await getDb();
    const row = (await db.getFirstAsync(
      'SELECT data FROM form WHERE id = ? AND active = 1',
      storeId
    )) as { data: string } | null;
    if (!row) {
      console.warn('[Storefront] Store not found locally');
      return;
    }

    const storeData = JSON.parse(row.data || '{}');
    const subdomain = storeData.subdomain;
    if (!subdomain) {
      console.warn('[Storefront] Store has no subdomain');
      return;
    }

    await publishToWorker(subdomain, layout);
  } catch (err: any) {
    console.error('[Storefront] Publish failed:', err?.message);
  }
}

/**
 * Load/save a store's storefront layout (draft + published) in the `matter` table.
 * Draft is what the owner edits via AI chat; published is what customers see.
 * On publish, syncs to Turso so the Worker can serve the page.
 *
 * Scoped to `s:{storeId}` per docs/plan.md.
 */
export function useStorefront(storeId?: string) {
  const db = useDb();
  dbRef = db;
  const [draft, setDraft] = useState<StorefrontLayout | null>(null);
  const [published, setPublished] = useState<StorefrontLayout | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const scope = storeId ? `s:${storeId}` : 'p';

  const refresh = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    const d = await db.getFirstAsync<LayoutRow>(
      "SELECT id, data FROM matter WHERE form = ? AND type = 'storefront_draft' AND active = 1 LIMIT 1",
      storeId
    );
    const p = await db.getFirstAsync<LayoutRow>(
      "SELECT id, data FROM matter WHERE form = ? AND type = 'storefront_published' AND active = 1 LIMIT 1",
      storeId
    );
    setDraftId(d?.id ?? null);
    setDraft(parseLayout(d?.data ? JSON.parse(d.data) : null));
    setPublished(parseLayout(p?.data ? JSON.parse(p.data) : null));
    setLoading(false);
  }, [db, storeId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  /** Upsert the draft layout. */
  const saveDraft = useCallback(async (layout: StorefrontLayout) => {
    if (!storeId) return;
    const json = JSON.stringify(layout);
    if (draftId) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, draftId);
    } else {
      const id = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'storefront_draft', ?, ?, 1)",
        id, storeId, scope, json
      );
    }
    // Mirror to the desktop live editor (non-blocking).
    pushDraftToWorker(storeId, layout);
    await refresh();
  }, [db, storeId, scope, draftId, refresh]);

  /** Copy the current draft into the published row + sync to Turso. */
  const publish = useCallback(async () => {
    if (!storeId || !draft) return;
    const json = JSON.stringify(draft);
    const existing = await db.getFirstAsync<LayoutRow>(
      "SELECT id FROM matter WHERE form = ? AND type = 'storefront_published' AND active = 1 LIMIT 1",
      storeId
    );
    if (existing?.id) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, existing.id);
    } else {
      const id = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'storefront_published', ?, ?, 1)",
        id, storeId, scope, json
      );
    }

    // Sync to Turso (non-blocking)
    syncToTurso(storeId, draft);

    await refresh();
  }, [db, storeId, scope, draft, refresh]);

  return { draft, published, loading, refresh, saveDraft, publish };
}
