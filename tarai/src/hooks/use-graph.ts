import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';

export interface GraphRow {
  src: string;
  rel: string;
  tgt: string;
  weight: number;
  active: number;
}

export function useGraph(src?: string, rel?: string) {
  const db = useDb();
  const [rows, setRows] = useState<GraphRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let query = 'SELECT * FROM graph WHERE active = 1';
    const params: any[] = [];
    if (src) { query += ' AND src = ?'; params.push(src); }
    if (rel) { query += ' AND rel = ?'; params.push(rel); }
    query += ' ORDER BY weight ASC';
    setRows(await db.getAllAsync<GraphRow>(query, params));
    setLoading(false);
  }, [db, src, rel]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const link = useCallback(async (srcId: string, tgtId: string, linkRel: string, weight = 0) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO graph (src, rel, tgt, weight, active) VALUES (?, ?, ?, ?, 1)',
      srcId, linkRel, tgtId, weight
    );
    await refresh();
  }, [db, refresh]);

  const unlink = useCallback(async (srcId: string, tgtId: string, linkRel: string) => {
    await db.runAsync(
      'UPDATE graph SET active = 0 WHERE src = ? AND rel = ? AND tgt = ?',
      srcId, linkRel, tgtId
    );
    await refresh();
  }, [db, refresh]);

  return { rows, loading, refresh, link, unlink };
}
