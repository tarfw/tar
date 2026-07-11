/**
 * Gen UI module for tarapp — exports all public APIs.
 */

// Types (shared with taragent)
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

export interface UIPlan {
  workspaceId: string;
  target: 'native' | 'web';
  revision: string;
  routes: UIRoute[];
}

// Registry
export {
  registerComponent,
  getComponent,
  getAllComponents,
  getComponentTypes,
  hasComponent,
  type ComponentEntry,
  type SectionProps,
} from './registry/ComponentRegistry';

// Import builtins to auto-register
import './registry/builtins';

// Renderer
export { default as NativeRenderer } from './registry/NativeRenderer';
