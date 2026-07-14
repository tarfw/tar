/**
 * Client-side inbox — fetch pending tasks and mark them done.
 */

const TAR_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://taragent.tar-54d.workers.dev';

export interface InboxTask {
  id: string;
  title: string;
  status: string;
  assigned_to: string;
  event_type?: string;
  event_data?: any;
  created_at: string;
}

let _userId = 'guest';

export function setInboxUserId(id: string) {
  _userId = id;
}

/**
 * Fetch pending tasks for a workspace.
 */
export async function fetchInbox(
  scope: string,
  limit: number = 50
): Promise<InboxTask[]> {
  try {
    const url = new URL(`${TAR_URL}/workspace/${scope}/inbox`);
    url.searchParams.set('userId', _userId);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: { 'X-User-Id': _userId },
    });
    if (!res.ok) return [];
    const data = await res.json() as { tasks?: InboxTask[] };
    return data.tasks || [];
  } catch (err) {
    console.warn('[inbox] Failed to fetch:', err);
    return [];
  }
}

/**
 * Mark a task as done.
 */
export async function markTaskDone(
  scope: string,
  taskId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${TAR_URL}/inbox/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': _userId,
      },
      body: JSON.stringify({ scope }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[inbox] Failed to mark done:', err);
    return false;
  }
}

/**
 * Fetch inbox across multiple workspaces.
 */
export async function fetchAllInboxes(
  scopes: string[],
  limit: number = 20
): Promise<InboxTask[]> {
  const results = await Promise.all(
    scopes.map(scope => fetchInbox(scope, limit))
  );
  return results.flat().sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
