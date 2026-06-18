import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';

export interface GraphRow {
  src: string;
  tgt: string;
  type: string;
  weight: number;
  active: number;
}

export function useGraph(src?: string, type?: string) {
  const db = useDb();
  const [rows, setRows] = useState<GraphRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let query = 'SELECT * FROM graph WHERE active = 1';
    const params: any[] = [];
    if (src) { query += ' AND src = ?'; params.push(src); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY weight ASC';
    setRows(await db.getAllAsync<GraphRow>(query, params));
    setLoading(false);
  }, [db, src, type]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const link = useCallback(async (srcId: string, tgtId: string, linkType: string, weight = 0) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO graph (src, tgt, type, weight, active) VALUES (?, ?, ?, ?, 1)',
      srcId, tgtId, linkType, weight
    );
    await refresh();
  }, [db, refresh]);

  const unlink = useCallback(async (srcId: string, tgtId: string, linkType: string) => {
    await db.runAsync(
      'DELETE FROM graph WHERE src = ? AND tgt = ? AND type = ?',
      srcId, tgtId, linkType
    );
    await refresh();
  }, [db, refresh]);

  return { rows, loading, refresh, link, unlink };
}
