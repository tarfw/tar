/**
 * tar — client API for tarflue-v2 backend (Cloudflare Workers).
 * Every backend call goes through this one module.
 */

const TAR_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://taragent.tar-54d.workers.dev';

let _userId = 'guest';

/** Set the current user ID (called from app init). */
export function setUserId(id: string) {
  console.log(`[tar] setUserId: ${id}`);
  _userId = id;
}

// ── Internal helpers ──────────────────────────────────────────

async function post<T = any>(path: string, body?: Record<string, any>): Promise<T> {
  console.log(`[tar] POST ${path} with X-User-Id: ${_userId}`);
  const res = await fetch(`${TAR_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': _userId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} failed: ${err}`);
  }
  return res.json() as Promise<T>;
}

async function get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TAR_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'X-User-Id': _userId },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────

export const tar = {
  /**
   * Talk to the AI agent.
   * POST /agents/master/:sessionId
   */
  chat: (sessionId: string, message: string, scope?: string) =>
    post(`/agents/master/${sessionId}`, { message, scope }),

  /**
   * Get AI Tasks for a workspace.
   * GET /ai-tasks?scope=...
   */
  aiTasks: (scope: string) =>
    get('/ai-tasks', { scope }),

  /**
   * Execute an AI Task directly.
   * POST /ai-tasks/execute
   */
  executeAITask: (action: string, params: Record<string, any>, scope: string) =>
    post('/ai-tasks/execute', { action, params, scope }),

  /**
   * Run one of the 6 generic tools: create, read, update, delete, link, search.
   * POST /tools/:name
   */
  tool: (name: string, input: Record<string, any>) =>
    post(`/tools/${name}`, input),

  /**
   * Run a named workflow (deterministic, no LLM).
   * POST /workflows/:name
   */
  workflow: (name: string, input: Record<string, any>) =>
    post(`/workflows/${name}`, input),

  /**
   * Vector search across marketplace (actions, skills).
   * GET /search?q=...
   */
  search: (query: string) =>
    get('/search', { q: query }),

  /**
   * List Telegram/Slack/Discord groups → workspace mappings.
   * GET /teams
   */
  listTeams: () =>
    get('/teams'),

  /**
   * Create a new workspace.
   * POST /workspaces/create
   */
  createWorkspace: (data: { name: string; subdomain: string; description?: string; message?: string; modules?: string[] }) =>
    post('/workspaces/create', data),

  // ── Tools Execute ────────────────────────────────────────────

  /**
   * Execute an action via the tools/execute endpoint.
   * POST /tools/execute
   */
  toolsExecute: (action: string, params: Record<string, any>, scope: string) =>
    post('/tools/execute', { action, params, scope }),

  // ── Workspace Events ─────────────────────────────────────────

  /**
   * Write an event to a workspace's motion table.
   * POST /workspace/:scope/events
   */
  writeEvent: (scope: string, type: string, data: Record<string, any>) =>
    post(`/workspace/${scope}/events`, { type, data }),

  // ── Workspace Inbox ──────────────────────────────────────────

  /**
   * Get pending tasks for a workspace.
   * GET /workspace/:scope/inbox
   */
  getInbox: (scope: string, userId?: string, limit?: number) => {
    const params: Record<string, string> = {};
    if (userId) params.userId = userId;
    if (limit) params.limit = String(limit);
    return get(`/workspace/${scope}/inbox`, Object.keys(params).length ? params : undefined);
  },

  /**
   * Mark a task as done.
   * PATCH /inbox/:taskId
   */
  markTaskDone: (taskId: string, scope: string) =>
    post(`/inbox/${taskId}`, { scope }),

  /**
   * List user's workspaces.
   * GET /workspaces
   */
  listWorkspaces: () =>
    get('/workspaces'),

  /**
   * Get user's personal timeline (motions across all workspaces).
   * GET /timeline?limit=50&since=...
   */
  timeline: (opts?: { limit?: number; since?: string }) => {
    const params: Record<string, string> = {};
    if (opts?.limit) params.limit = String(opts.limit);
    if (opts?.since) params.since = opts.since;
    return get('/timeline', Object.keys(params).length ? params : undefined);
  },

  // ── OKF (Open Knowledge Format) files ─────────────────────

  okf: {
    /** Read an OKF file from Railway S3. */
    read: (scope: string, path: string) =>
      get('/okf/read', { scope, path }),

    /** Read workspace root index.md. */
    readIndex: (scope: string) =>
      get('/okf/index', { scope }),

    /** Upload or overwrite an OKF file. */
    upload: (scope: string, path: string, content: string) =>
      post('/okf/upload', { scope, path, content }),

    /** Edit an existing OKF file. */
    edit: (scope: string, path: string, content: string) =>
      post('/okf/edit', { scope, path, content }),
  },

  // ── Canvas Operations ─────────────────────────────────────

  canvas: {
    /** Add a skill or block to active canvas.md */
    add: (scope: string, block: string | { title?: string; type: string; props?: Record<string, any> }) =>
      post('/canvas/add', { scope, block }),

    /** Remove a skill or block from active canvas.md */
    remove: (scope: string, moduleOrTitle: string) =>
      post('/canvas/remove', { scope, module: moduleOrTitle }),
  },
};
