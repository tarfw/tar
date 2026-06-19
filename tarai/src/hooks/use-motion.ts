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
  urgency: 'Now' | 'Next' | 'Later' | 'Done';
  time: string;
  status: 'todo' | 'in_progress' | 'done';
  route: string;
  routeParams: Record<string, string>;
}

export interface ActionGroup {
  id: string;
  name: string;
  type: string;
  color: string;
  actions: ActionItem[];
}

const ACTION_LABELS: Record<number, string> = {
  100: 'New task',
  207: 'Task due soon',
  208: 'Task overdue',
  301: 'Store visit',
  302: 'Review lead',
  303: 'New lead',
  306: 'New ticket',
  307: 'Ticket reply',
  402: 'Follow up',
  506: 'New inquiry',
  601: 'New order',
  606: 'Order update',
  702: 'New request',
};

function getActionLabel(action: number, formType: string): string {
  return ACTION_LABELS[action] || (formType === 'task' ? 'Task' : 'Action');
}

function getUrgency(action: number, data: any): 'Now' | 'Next' | 'Later' | 'Done' {
  const doneSet = new Set([204, 210, 308, 606, 702]);
  if (doneSet.has(action)) return 'Done';
  if (action === 208) return 'Now';
  if (action === 207) return 'Next';
  return data.urgency || 'Now';
}

function getStatus(action: number, phase: number): 'todo' | 'in_progress' | 'done' {
  const doneSet = new Set([204, 210, 308, 606, 702]);
  if (doneSet.has(action) || phase >= 100) return 'done';
  if (action === 207 || action === 304 || action === 402 || phase > 0) return 'in_progress';
  return 'todo';
}

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

export function useMotion(urgency?: string) {
  const db = useDb();
  const [groups, setGroups] = useState<ActionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<MotionRow>(
      'SELECT * FROM motion ORDER BY time DESC'
    );

    const streamIds = [...new Set(rows.map(r => r.stream))];
    const formMap: Record<string, { title: string; type: string; data: string }> = {};
    for (const id of streamIds) {
      const form = await db.getFirstAsync<{ title: string; type: string; data: string }>(
        'SELECT title, type, data FROM form WHERE id = ?',
        id
      );
      if (form) formMap[id] = form;
    }

    const latestByStream = new Map<string, MotionRow>();
    for (const row of rows) {
      if (!latestByStream.has(row.stream)) {
        latestByStream.set(row.stream, row);
      }
    }

    const ticketCustomerIds = new Map<string, string>();
    for (const [stream, form] of Object.entries(formMap)) {
      if (form.type === 'ticket') {
        const fd = parseData(form.data);
        if (fd.customer) ticketCustomerIds.set(stream, fd.customer);
      }
    }

    const customerIds = [...new Set(ticketCustomerIds.values())];
    for (const cid of customerIds) {
      if (!formMap[cid]) {
        const cf = await db.getFirstAsync<{ title: string; type: string; data: string }>(
          'SELECT title, type, data FROM form WHERE id = ?', cid
        );
        if (cf) formMap[cid] = cf;
      }
    }

    const taskIds = streamIds.filter(id => formMap[id]?.type === 'task');
    const taskMatters: Record<string, { subtasks: any[]; status: string }> = {};
    for (const tid of taskIds) {
      const m = await db.getFirstAsync<{ data: string }>(
        "SELECT data FROM matter WHERE form = ? AND type = 'task_state' AND active = 1 LIMIT 1",
        tid
      );
      if (m) {
        const md = parseData(m.data);
        taskMatters[tid] = {
          subtasks: md.subtasks || [],
          status: md.status || 'todo',
        };
      }
    }

    const groupMap = new Map<string, ActionGroup>();

    for (const [stream, motion] of latestByStream) {
      const form = formMap[stream];
      if (!form) continue;

      const formType = form.type;
      let groupId = stream;
      let groupForm = form;

      if (formType === 'ticket') {
        const customerId = ticketCustomerIds.get(stream);
        if (customerId && formMap[customerId]) {
          groupId = customerId;
          groupForm = formMap[customerId];
        }
      }

      const data = parseData(motion.data);
      const label = getActionLabel(motion.action, formType);
      const urgencyVal = getUrgency(motion.action, data);
      const status = getStatus(motion.action, motion.phase);
      const route = '/entity';
      const formData = parseData(groupForm.data);

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          name: groupForm.title,
          type: groupForm.type,
          color: formData.color || '#5E6AD2',
          actions: [],
        });
      }

      const group = groupMap.get(groupId)!;

      if (formType === 'task') {
        const taskState = taskMatters[stream];
        if (taskState && taskState.subtasks.length > 0) {
          const doneCount = taskState.subtasks.filter((s: any) => s.done).length;
          const allDone = doneCount === taskState.subtasks.length;
          group.actions.push({
            id: `${stream}_${motion.seq}`,
            title: form.title,
            subtitle: `${doneCount}/${taskState.subtasks.length} subtasks`,
            vertical: 'task',
            urgency: allDone ? 'Done' : urgencyVal,
            time: motion.time,
            status: allDone ? 'done' : taskState.status === 'done' ? 'done' : 'todo',
            route,
            routeParams: { id: stream },
          });
          for (const sub of taskState.subtasks) {
            group.actions.push({
              id: `${stream}_sub_${sub.id}`,
              title: sub.title,
              subtitle: undefined,
              vertical: 'subtask',
              urgency: sub.done ? 'Done' : urgencyVal,
              time: motion.time,
              status: sub.done ? 'done' : 'todo',
              route,
              routeParams: { id: stream },
            });
          }
        } else {
          group.actions.push({
            id: `${stream}_${motion.seq}`,
            title: form.title,
            subtitle: label,
            vertical: 'task',
            urgency: urgencyVal,
            time: motion.time,
            status: taskState?.status === 'done' ? 'done' : status,
            route,
            routeParams: { id: stream },
          });
        }
      } else {
        group.actions.push({
          id: `${stream}_${motion.seq}`,
          title: label,
          subtitle: data.text || data.subject || formType === 'ticket' ? form.title : undefined,
          vertical: formType,
          urgency: urgencyVal,
          time: motion.time,
          status,
          route,
          routeParams: { id: stream },
        });
      }
    }

    let result = Array.from(groupMap.values());

    if (urgency) {
      result = result
        .map(g => ({ ...g, actions: g.actions.filter(a => a.urgency === urgency) }))
        .filter(g => g.actions.length > 0);
    }

    result.sort((a, b) => {
      const aTime = a.actions[0]?.time || '';
      const bTime = b.actions[0]?.time || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setGroups(result);
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
    await db.runAsync(
      'INSERT INTO motion (stream, seq, action, phase, delta, data, time) VALUES (?, ?, ?, 0, ?, ?, ?)',
      stream, seq, action, delta, JSON.stringify(data), now
    );
    await refresh();
  }, [db, refresh]);

  return { groups, loading, refresh, emit };
}
