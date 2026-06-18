import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';

export interface MatterRow {
  id: string;
  form: string;
  type: string;
  qty: number;
  value: number;
  data: string;
  time: string;
  active: number;
}

export function useMatter(formId?: string) {
  const db = useDb();
  const [rows, setRows] = useState<MatterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let query = 'SELECT * FROM matter WHERE active = 1';
    const params: any[] = [];
    if (formId) { query += ' AND form = ?'; params.push(formId); }
    query += ' ORDER BY time DESC';
    setRows(await db.getAllAsync<MatterRow>(query, params));
    setLoading(false);
  }, [db, formId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  return { rows, loading, refresh };
}
