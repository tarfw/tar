import { useState, useEffect, useCallback } from 'react';
import { useDb } from '@/db/provider';

export interface MotionRow {
  stream: string;
  seq: number;
  action: number;
  phase: number;
  delta: number;
  data: string;
  time: string;
}

export interface ActionItem {
  id: string;
  title: string;
  subtitle?: string;
  vertical: string;
  scope: string;
  urgency: 'Now' | 'Next' | 'Later' | 'Done';
  time: string;
  status: 'todo' | 'in_progress' | 'done';
  assigneeInitials?: string;
  assigneeColor?: string;
}

function motionToAction(m: MotionRow): ActionItem {
  const d = JSON.parse(m.data);
  const statusMap: Record<number, 'todo' | 'in_progress' | 'done'> = {
    100: 'todo', 208: 'todo', 306: 'todo', 506: 'todo', 601: 'todo',
    304: 'in_progress', 402: 'in_progress', 207: 'in_progress',
    606: 'done', 308: 'done', 204: 'done', 210: 'done', 702: 'done',
  };
  const phaseStatus: 'todo' | 'in_progress' | 'done' = m.phase >= 100 ? 'done' : m.phase > 0 ? 'in_progress' : 'todo';
  return {
    id: `${m.stream}_${m.seq}`,
    title: d.title || m.stream,
    subtitle: d.subtitle,
    vertical: d.vertical || 'General',
    scope: d.scope || '',
    urgency: d.urgency || 'Now',
    time: m.time,
    status: statusMap[m.action] ?? phaseStatus,
    assigneeInitials: d.assigneeInitials,
    assigneeColor: d.assigneeColor,
  };
}

export function useMotion(urgency?: string) {
  const db = useDb();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<MotionRow>(
      'SELECT * FROM motion ORDER BY time DESC'
    );
    let items = rows.map(motionToAction);
    if (urgency) items = items.filter(a => a.urgency === urgency);
    console.log(`[DB] READ motion → ${rows.length} rows${urgency ? ` (urgency=${urgency})` : ''}`);
    setActions(items);
    setLoading(false);
  }, [db, urgency]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  const emit = useCallback(async (stream: string, action: number, data: Record<string, any>, delta = 0) => {
    const now = new Date().toISOString();
    const last = await db.getFirstAsync<{ max_seq: number }>(
      'SELECT COALESCE(MAX(seq), 0) as max_seq FROM motion WHERE stream = ?', stream
    );
    const seq = (last?.max_seq || 0) + 1;
    console.log(`[DB] INSERT motion stream=${stream} seq=${seq} action=${action}`);
    await db.runAsync(
      'INSERT INTO motion (stream, seq, action, phase, delta, data, time) VALUES (?, ?, ?, 0, ?, ?, ?)',
      stream, seq, action, delta, JSON.stringify(data), now
    );
    await refresh();
  }, [db, refresh]);

  return { actions, loading, refresh, emit };
}
