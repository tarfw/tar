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

async function publishToWorker(subdomain: string, layout: SiteLayout, workspaceName?: string): Promise<void> {
  try {
    const cleanSub = subdomain.replace(/^w:/, '');
    const res = await fetch(`https://${cleanSub}.tarai.space/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: cleanSub, workspaceName: workspaceName || cleanSub, layout }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Site] Worker publish failed (${res.status}):`, body.slice(0, 200));
    } else {
      console.log(`[Site] Published to Worker: ${cleanSub}.tarai.space`);
    }
  } catch (err: any) {
    console.error('[Site] Worker publish error:', err?.message);
  }
}

async function pushDraftToWorker(subdomain: string, layout: SiteLayout): Promise<void> {
  if (!subdomain) return;
  const cleanSub = subdomain.replace(/^w:/, '');
  try {
    await fetch(`https://${cleanSub}.tarai.space/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: cleanSub, layout }),
    });
  } catch (err: any) {
    console.error('[Site] Draft push error:', err?.message);
  }
}

export function useSite(storeIdInput?: string) {
  const db = useDb();
  dbRef = db;
  const storeId = (storeIdInput || 'default').trim();
  const [draft, setDraft] = useState<SiteLayout | null>(null);
  const [published, setPublished] = useState<SiteLayout | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const scope = storeId.startsWith('w:') ? storeId : `w:${storeId}`;
  const cleanId = storeId.replace(/^w:/, '');

  const refresh = useCallback(async () => {
    try {
      let d = await db.getFirstAsync<LayoutRow>(
        "SELECT id, data FROM matter WHERE (form = ? OR form = ? OR scope = ? OR scope = ?) AND type IN ('site_draft', 'storefront_draft') AND active = 1 ORDER BY rowid DESC LIMIT 1",
        storeId, cleanId, scope, `s:${cleanId}`
      );
      if (!d) {
        d = await db.getFirstAsync<LayoutRow>(
          "SELECT id, data FROM matter WHERE type IN ('site_draft', 'storefront_draft') AND active = 1 ORDER BY rowid DESC LIMIT 1"
        );
      }

      let p = await db.getFirstAsync<LayoutRow>(
        "SELECT id, data FROM matter WHERE (form = ? OR form = ? OR scope = ? OR scope = ?) AND type IN ('site_published', 'storefront_published') AND active = 1 ORDER BY rowid DESC LIMIT 1",
        storeId, cleanId, scope, `s:${cleanId}`
      );
      if (!p) {
        p = await db.getFirstAsync<LayoutRow>(
          "SELECT id, data FROM matter WHERE type IN ('site_published', 'storefront_published') AND active = 1 ORDER BY rowid DESC LIMIT 1"
        );
      }

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
    } catch (err) {
      console.warn('[useSite] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, cleanId, scope]);

  useEffect(() => {
    refresh();
  }, [storeId, cleanId, scope]);

  const saveDraft = useCallback(async (layout: SiteLayout) => {
    const json = JSON.stringify(layout);
    const targetForm = cleanId;
    let currentId = draftId;
    if (!currentId) {
      const existing = await db.getFirstAsync<LayoutRow>(
        "SELECT id FROM matter WHERE (form = ? OR form = ? OR scope = ?) AND type IN ('site_draft', 'storefront_draft') AND active = 1 LIMIT 1",
        targetForm, cleanId, scope
      );
      if (existing?.id) currentId = existing.id;
    }

    if (currentId) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, currentId);
    } else {
      const newId = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'site_draft', ?, ?, 1)",
        newId, targetForm, scope, json
      );
      setDraftId(newId);
    }
    setDraft(layout);
    pushDraftToWorker(cleanId, layout);
  }, [storeId, cleanId, scope, draftId]);

  const publish = useCallback(async (subdomainOverride?: string, workspaceName?: string) => {
    const activeLayout = draft || DEFAULT_LAYOUT;
    const json = JSON.stringify(activeLayout);
    const targetForm = cleanId;
    const existing = await db.getFirstAsync<LayoutRow>(
      "SELECT id FROM matter WHERE (form = ? OR form = ? OR scope = ?) AND type IN ('site_published', 'storefront_published') AND active = 1 LIMIT 1",
      targetForm, cleanId, scope
    );
    if (existing?.id) {
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', json, existing.id);
    } else {
      const id = `matter_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, scope, data, active) VALUES (?, ?, 'site_published', ?, ?, 1)",
        id, targetForm, scope, json
      );
    }
    setPublished(activeLayout);

    // Always prefer explicit subdomain override (from WorkspaceSiteScreen or workspace card).
    // cleanId may be an internal scope ID (e.g. "abc123") not the URL slug (e.g. "velvet-brew").
    const sub = subdomainOverride || cleanId;
    if (sub) {
      await publishToWorker(sub, activeLayout, workspaceName);
    }
  }, [storeId, cleanId, scope, draft]);

  return { draft, published, loading, refresh, saveDraft, publish };
}
