/**
 * Cloud MCP client interface for `w:` (workspace) scopes.
 *
 * Currently a placeholder interface. When a Cloudflare Worker / Durable Object
 * MCP server is configured, set the client via `setCloudMcpClient()`.
 */

export interface CloudMcpClient {
  call(tool: string, params: Record<string, any>): Promise<any>;
}

let cloudClient: CloudMcpClient | null = null;

export function setCloudMcpClient(client: CloudMcpClient): void {
  cloudClient = client;
  console.log('[REMOTE] Cloud MCP client registered');
}

export function getCloudMcpClient(): CloudMcpClient | null {
  return cloudClient;
}

/**
 * If scope is a cloud scope and a cloud client is configured, forward the tool call.
 * Returns null for local scopes or when no cloud client is set.
 */
function isCloudScope(scope: string): boolean {
  return scope === 'w' || scope.startsWith('w:') || scope === 'o' || scope.startsWith('o:');
}

export async function forwardToCloud<T>(
  scope: string,
  toolName: string,
  params: Record<string, any>
): Promise<T | null> {
  if (!isCloudScope(scope)) return null;
  const client = getCloudMcpClient();
  if (!client) {
    // No cloud client configured; caller should fall back to local/shared DB routing.
    return null;
  }
  return client.call(toolName, params) as T;
}

export class CloudNotConfiguredError extends Error {
  constructor(scope: string) {
    super(`Cloud MCP not configured for scope ${scope}`);
    this.name = 'CloudNotConfiguredError';
  }
}
