/**
 * SiteLayout types and Zod schemas.
 * Shared between tarapp (native) and taragent (web).
 *
 * THE ONE PIPELINE:
 * OKF .md files → AI produces JSON layout → Validate → Registry renders → Live
 */

import { z } from 'zod';

// ── UINode (recursive) ──────────────────────────────────────────────

const BindingSchema = z.object({
  resource: z.string().min(1),
});

const ActionRefSchema = z.object({
  action: z.string().min(1),
});

export const UINodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    variant: z.string().optional(),
    layout: z.string().optional(),
    props: z.record(z.string(), z.any()).default({}),
    css: z.record(z.string(), z.any()).optional(),
    responsive: z.record(z.string(), z.any()).optional(),
    bindings: z.record(z.string(), BindingSchema).optional(),
    actions: z.record(z.string(), ActionRefSchema).optional(),
    children: z.array(UINodeSchema).optional(),
  })
);

export type UINode = {
  id: string;
  type: string;
  variant?: string;
  layout?: string;
  props: Record<string, any>;
  css?: Record<string, any>;
  responsive?: Record<string, any>;
  bindings?: Record<string, { resource: string }>;
  actions?: Record<string, { action: string }>;
  children?: UINode[];
};

// ── Route ───────────────────────────────────────────────────────────

export const UIRouteSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  nodes: z.array(UINodeSchema),
});

export type UIRoute = {
  id: string;
  path: string;
  nodes: UINode[];
};

// ── SiteLayout (top-level) ─────────────────────────────────────────────

export const SiteLayoutSchema = z.object({
  workspaceId: z.string().min(1),
  target: z.enum(['native', 'web']),
  revision: z.string().min(1),
  routes: z.array(UIRouteSchema),
});

export type SiteLayout = {
  workspaceId: string;
  target: 'native' | 'web';
  revision: string;
  routes: UIRoute[];
};

// ── Validation helpers ──────────────────────────────────────────────

export function validateSiteLayout(data: unknown): SiteLayout | null {
  const result = SiteLayoutSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function flattenNodes(plan: SiteLayout): UINode[] {
  const out: UINode[] = [];
  for (const route of plan.routes) {
    const walk = (nodes: UINode[]) => {
      for (const node of nodes) {
        out.push(node);
        if (node.children) walk(node.children);
      }
    };
    walk(route.nodes);
  }
  return out;
}

// ── Component catalog type ──────────────────────────────────────────

export interface ComponentCatalogEntry {
  type: string;
  label: string;
  icon: string;
  description: string;
  propsSchema: z.ZodObject<any>;
}

// ── Resource catalog type ───────────────────────────────────────────

export interface ResourceCatalogEntry {
  id: string;
  label: string;
  description: string;
  resolve: (scope: string, env: any) => Promise<any>;
}

// ── Action catalog type ─────────────────────────────────────────────

export interface ActionCatalogEntry {
  id: string;
  label: string;
  description: string;
  params: z.ZodObject<any>;
  execute: (params: any, scope: string, env: any) => Promise<any>;
}

// ── Memory types ────────────────────────────────────────────────────

export interface UIMemory {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'staff' | 'customer';
  density: 'comfortable' | 'compact';
  preferredModules: string[];
  accessibility: {
    reducedMotion: boolean;
    largeText: boolean;
  };
  excludedVariants: string[];
  approvedDesignRevision: string;
}

export const UIMemorySchema = z.object({
  userId: z.string(),
  workspaceId: z.string(),
  role: z.enum(['owner', 'staff', 'customer']),
  density: z.enum(['comfortable', 'compact']),
  preferredModules: z.array(z.string()),
  accessibility: z.object({
    reducedMotion: z.boolean(),
    largeText: z.boolean(),
  }),
  excludedVariants: z.array(z.string()),
  approvedDesignRevision: z.string(),
});

// ── Planner context ─────────────────────────────────────────────────

export interface PlannerContext {
  workspaceId: string;
  target: 'native' | 'web';
  designTokens: Record<string, any>;
  availableModules: string[];
  memory?: UIMemory;
  currentPlan?: SiteLayout;
  instruction?: string;
}

// ── Revision types ──────────────────────────────────────────────────

export interface UIRevision {
  id: string;
  workspaceId: string;
  target: 'native' | 'web';
  plan: SiteLayout;
  createdAt: string;
  status: 'draft' | 'approved' | 'active' | 'archived';
}
