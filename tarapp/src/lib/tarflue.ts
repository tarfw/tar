/**
 * HTTP client for tarflue (Flue Cloudflare Worker).
 * All Flue tool calls go through this client.
 */

const TARFLUE_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tar-54d.workers.dev';

interface ToolResponse<T = any> {
  data?: T;
  error?: string;
}

async function callTool<T = any>(toolName: string, input: Record<string, any>): Promise<T> {
  const res = await fetch(`${TARFLUE_URL}/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tool ${toolName} failed: ${err}`);
  }

  return res.json() as Promise<T>;
}

async function callAgent(agentName: string, id: string, message: string): Promise<any> {
  const res = await fetch(`${TARFLUE_URL}/agents/${agentName}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Agent ${agentName} failed: ${err}`);
  }

  return res.json();
}

async function callWorkflow(workflowName: string, input: Record<string, any>): Promise<any> {
  const res = await fetch(`${TARFLUE_URL}/workflows/${workflowName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Workflow ${workflowName} failed: ${err}`);
  }

  return res.json();
}

// ============================================================
// 6 Generic Tools — matches tarflue-v2 tool names
// ============================================================

export const tarflue = {
  tools: {
    create: (input: any) => callTool('create', input),
    read: (input: any) => callTool('read', input),
    update: (input: any) => callTool('update', input),
    delete: (input: any) => callTool('delete', input),
    link: (input: any) => callTool('link', input),
    search: (input: any) => callTool('search', input),
  },
  agents: {
    chat: (message: string) => callAgent('master', 'default', message),
  },
  workflows: {
    checkout: (input: any) => callWorkflow('checkout', input),
  },
  timeline: {
    get: async (options?: { limit?: number; since?: string }) => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.since) params.set('since', options.since);
      const url = `${TARFLUE_URL}/timeline${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  },
  marketplace: {
    templates: async (query?: string) => {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${TARFLUE_URL}/marketplace/templates${params}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    install: async (templateId: string, scope: string) => {
      const res = await fetch(`${TARFLUE_URL}/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, scope }),
      });
      if (!res.ok) throw new Error('Failed to install template');
      return res.json();
    },
  },
  workspace: {
    create: async (data: { name: string; template: string; subdomain: string }) => {
      const res = await fetch(`${TARFLUE_URL}/workspaces/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create workspace');
      }
      return res.json();
    },
    list: async () => {
      const res = await fetch(`${TARFLUE_URL}/workspaces`);
      if (!res.ok) throw new Error('Failed to fetch workspaces');
      return res.json();
    },
  },
};
