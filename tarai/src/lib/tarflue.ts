/**
 * HTTP client for tarflue (Flue Cloudflare Worker).
 * All Flue tool calls go through this client.
 */

const TARFLUE_URL = process.env.EXPO_PUBLIC_TARFLUE_URL || 'https://tarflue.tarai.space';

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
// Convenience wrappers for each tool
// ============================================================

export const tarflue = {
  tools: {
    createMatter: (input: any) => callTool('create_matter', input),
    getMatter: (input: any) => callTool('get_matter', input),
    listMatters: (input: any) => callTool('list_matters', input),
    updateMatter: (input: any) => callTool('update_matter', input),
    appendMotion: (input: any) => callTool('append_motion', input),
    readMotions: (input: any) => callTool('read_motions', input),
    linkGraph: (input: any) => callTool('link_graph', input),
    traverseGraph: (input: any) => callTool('traverse_graph', input),
    setAttr: (input: any) => callTool('set_attr', input),
    searchMemory: (input: any) => callTool('search_memory', input),
    storeMemory: (input: any) => callTool('store_memory', input),
    readForm: (input: any) => callTool('read_form', input),
  },
  agents: {
    chat: (message: string) => callAgent('master', 'default', message),
  },
  workflows: {
    checkout: (input: any) => callWorkflow('checkout', input),
  },
};
