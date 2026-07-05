/**
 * tar — client API for tarflue-v2 backend (Cloudflare Workers).
 * Every backend call goes through this one module.
 */

const TAR_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tar-54d.workers.dev';

// ── Internal helpers ──────────────────────────────────────────

async function post<T = any>(path: string, body?: Record<string, any>): Promise<T> {
  const res = await fetch(`${TAR_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET ${path} failed: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────

export const tar = {
  /**
   * Talk to the AI agent.
   * POST /agents/master/:sessionId
   */
  chat: (sessionId: string, message: string) =>
    post(`/agents/master/${sessionId}`, { message }),

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
   * Vector search across marketplace (templates, actions, skills).
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
   * Install a marketplace template into a workspace scope.
   * POST /marketplace/install
   */
  installTemplate: (templateId: string, scope: string) =>
    post('/marketplace/install', { templateId, scope }),

  /**
   * Browse marketplace templates.
   * GET /marketplace/templates?q=...
   */
  templates: (query?: string) =>
    get('/marketplace/templates', query ? { q: query } : undefined),

  /**
   * Create a new workspace.
   * POST /workspaces/create
   */
  createWorkspace: (data: { name: string; template: string; subdomain: string }) =>
    post('/workspaces/create', data),

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
};
