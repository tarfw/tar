/**
 * Gen UI types — shared with taragent.
 */

export interface UINode {
  id: string;
  type: string;
  variant?: string;
  props: Record<string, any>;
  bindings?: Record<string, { resource: string }>;
  actions?: Record<string, { action: string }>;
  children?: UINode[];
}

export interface UIRoute {
  id: string;
  path: string;
  nodes: UINode[];
}

export interface SiteLayout {
  workspaceId: string;
  target: 'native' | 'web';
  revision: string;
  routes: UIRoute[];
}
