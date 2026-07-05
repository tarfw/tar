import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';

export interface FormRow {
  id: string;
  type: string;
  title: string;
  scope: string;
  data: string;
  time: string;
  active: number;
}

export function useForm(type?: string, scope?: string) {
  const db = useDb();
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let query = 'SELECT * FROM form WHERE active = 1';
    const params: any[] = [];
    if (type) { query += ' AND type = ?'; params.push(type); }
    if (scope) { query += ' AND scope = ?'; params.push(scope); }
    query += ' ORDER BY time DESC';
    const result = await db.getAllAsync<FormRow>(query, params);
    console.log(`[DB] READ form type=${type ?? 'all'} scope=${scope ?? 'all'} → ${result.length} rows`);
    setRows(result);
    setLoading(false);
  }, [db, type, scope]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (id: string, formType: string, title: string, scope: string, data: Record<string, any> = {}) => {
    const now = new Date().toISOString();
    console.log(`[DB] CREATE form id=${id} type=${formType} title="${title}" scope=${scope}`);
    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, formType, title, scope, JSON.stringify(data), now
    );
    await refresh();
  }, [db, refresh]);

  const update = useCallback(async (id: string, fields: Partial<Pick<FormRow, 'title' | 'data' | 'active'>>) => {
    const sets: string[] = [];
    const params: any[] = [];
    if (fields.title !== undefined) { sets.push('title = ?'); params.push(fields.title); }
    if (fields.data !== undefined) { sets.push('data = ?'); params.push(typeof fields.data === 'string' ? fields.data : JSON.stringify(fields.data)); }
    if (fields.active !== undefined) { sets.push('active = ?'); params.push(fields.active); }
    if (sets.length === 0) return;
    params.push(id);
    console.log(`[DB] UPDATE form id=${id} sets=[${sets.join(', ')}]`);
    await db.runAsync(`UPDATE form SET ${sets.join(', ')} WHERE id = ?`, params);
    await refresh();
  }, [db, refresh]);

  const remove = useCallback(async (id: string) => {
    console.log(`[DB] DELETE (soft) form id=${id}`);
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', id);
    await refresh();
  }, [db, refresh]);

  return { rows, loading, refresh, create, update, remove };
}

export function useFormById(id: string | undefined) {
  const db = useDb();
  const [row, setRow] = useState<FormRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) { setRow(null); setLoading(false); return; }
    const r = await db.getFirstAsync<FormRow>('SELECT * FROM form WHERE id = ?', id);
    console.log(`[DB] READ form id=${id} → ${r ? 'found' : 'not found'}`);
    setRow(r);
    setLoading(false);
  }, [db, id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return { row, loading };
}
