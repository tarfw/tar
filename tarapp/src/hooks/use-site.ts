import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';
import {
  DEFAULT_LAYOUT,
  parseLayout,
  type SiteLayout,
} from '@/lib/site-schema';

interface LayoutRow {
  id: string;
  data: string;
}

let dbRef: any = null;
function getDb() {
  if (!dbRef) {
    throw new Error('DB not initialized');
  }
  return dbRef;
}

async function publishToWorker(subdomain: string, layout: SiteLayout): Promise<void> {
  try {
    const res = await fetch(`https://${subdomain}.tarai.space/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, layout }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Site] Worker publish failed (${res.status}):`, body.slice(0, 200));
    } else {
      console.log(`[Site] Published to Worker: ${subdomain}.tarai.space`);
    }
  } catch (err: any) {
    console.error('[Site] Worker publish error:', err?.message);
  }
}

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

async function pushDraftToWorker(storeId: string, layout: SiteLayout): Promise<void> {
  const subdomain = await getSubdomain(storeId);
  if (!subdomain) return;
  try {
    await fetch(`https://${subdomain}.tarai.space/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, layout }),
    });
  } catch (err: any) {
    console.error('[Site] Draft push error:', err?.message);
  }
}

async function syncToTurso(
  storeId: string,
  layout: SiteLayout
): Promise<void> {
  try {
    const db = await getDb();
    const row = (await db.getFirstAsync(
      'SELECT data FROM form WHERE id = ? AND active = 1',
      storeId
    )) as { data: string } | null;
    if (!row) {
      console.warn('[Site] Store not found locally');
      return;
    }

    const storeData = JSON.parse(row.data || '{}');
    const subdomain = storeData.subdomain;
    if (!subdomain) {
      console.warn('[Site] Store has no subdomain');
      return;
    }

    await publishToWorker(subdomain, layout);
  } catch (err: any) {
    console.error('[Site] Publish failed:', err?.message);
  }
}

export function useSite(storeId?: string) {
  const db = useDb();
  dbRef = db;
  const [draft, setDraft] = useState<SiteLayout | null>(null);
  const [published, setPublished] = useState<SiteLayout | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const scope = storeId ? `s:${storeId}` : 'p';

  const refresh = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    // Query either storefront_draft or site_draft for backward compatibility
    let d = await db.getFirstAsync<LayoutRow>(
      "SELECT id, data FROM matter WHERE form = ? AND type IN ('site_draft', 'storefront_draft') AND active = 1 LIMIT 1",
      storeId
    );
    let p = await db.getFirstAsync<LayoutRow>(
      "SELECT id, data FROM matter WHERE form = ? AND type IN ('site_published', 'storefront_published') AND active = 1 LIMIT 1",
      storeId
    );
    setDraftId(d?.id ?? null);
    
    let parsedDraft = null;
    if (d?.data) {
      try { parsedDraft = JSON.parse(d.data); } catch (err) { console.warn('[useSite] Failed to parse draft JSON:', err); }
    }
    setDraft(parseLayout(parsedDraft));

    let parsedPub = null;
    if (p?.data) {
      try { parsedPub = JSON.parse(p.data); } catch (err) { console.warn('[useSite] Failed to parse published JSON:', err); }
    }
    setPublished(parseLayout(parsedPub));
    setLoading(false);
  }, [db, storeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveDraft = useCallback(async (layout: SiteLayout) => {
    if (!storeId) return;
    const json = JSON.stringify(layout);
    if (draftId) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, draftId);
    } else {
      const id = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'site_draft', ?, ?, 1)",
        id, storeId, scope, json
      );
    }
    pushDraftToWorker(storeId, layout);
    await refresh();
  }, [db, storeId, scope, draftId, refresh]);

  const publish = useCallback(async () => {
    if (!storeId || !draft) return;
    const json = JSON.stringify(draft);
    const existing = await db.getFirstAsync<LayoutRow>(
      "SELECT id FROM matter WHERE form = ? AND type IN ('site_published', 'storefront_published') AND active = 1 LIMIT 1",
      storeId
    );
    if (existing?.id) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, existing.id);
    } else {
      const id = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'site_published', ?, ?, 1)",
        id, storeId, scope, json
      );
    }

    syncToTurso(storeId, draft);
    await refresh();
  }, [db, storeId, scope, draft, refresh]);

  return { draft, published, loading, refresh, saveDraft, publish };
}
