/**
 * tarsite — Core Versioned Contracts (Phase 2)
 * Pure, deterministic, versioned TypeScript & Zod schemas for UIPlan.
 *
 * ABSOLUTE RULE: Separation of layout structures, data bindings, and visual tokens.
 * Zero code string execution.
 */

import { z } from 'zod';

// ── 1. Data Binding Contract ─────────────────────────────────────────

export const BindingSchema = z.object({
  resource: z.string().min(1),
  params: z.record(z.string(), z.any()).optional(),
  transform: z.enum(['array', 'single', 'count']).optional(),
});

export type Binding = z.infer<typeof BindingSchema>;

export const ActionRefSchema = z.object({
  action: z.string().min(1),
  params: z.record(z.string(), z.any()).optional(),
});

export type ActionRef = z.infer<typeof ActionRefSchema>;

// ── 2. Section Contract (Universal OKF Contract) ───────────────────

export const SectionContractSchema = z.object({
  columns: z.number().optional(),
  aspect_ratio: z.string().optional(),
  hover_zoom: z.number().optional(),
  gap: z.string().optional(),
  card_bg: z.string().optional(),
  card_border: z.string().optional(),
  card_radius: z.string().optional(),
  backdrop_blur: z.string().optional(),
  sticky: z.boolean().optional(),
  speed: z.string().optional(),
  bg: z.string().optional(),
  text_color: z.string().optional(),
  cta_bg: z.string().optional(),
  cta_text: z.string().optional(),
  height: z.string().optional(),
  logo_position: z.enum(['left', 'center', 'right']).optional(),
  cta_shape: z.enum(['pill', 'rounded', 'square']).optional(),
  layout_mode: z.enum(['split', 'full', 'grid', 'overlay']).optional(),
}).passthrough();

export type SectionContract = z.infer<typeof SectionContractSchema>;

// ── 3. UINode AST Contract (Recursive Layout) ────────────────────────

export const UINodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    variant: z.string().optional(),
    layout: z.enum(['flex-col', 'flex-row', 'grid-2', 'grid-3', 'grid-4', 'full', 'split']).optional(),
    props: z.record(z.string(), z.any()).optional().default({}),
    css: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    responsive: z
      .object({
        mobile: z.record(z.string(), z.any()).optional(),
        tablet: z.record(z.string(), z.any()).optional(),
      })
      .optional(),
    contract: z.record(z.string(), z.any()).optional(),
    bindings: z.record(z.string(), BindingSchema).optional(),
    actions: z.record(z.string(), ActionRefSchema).optional(),
    children: z.array(UINodeSchema).optional(),
  }) as any
);

export type UINode = {
  id: string;
  type: string;
  variant?: string;
  layout?: 'flex-col' | 'flex-row' | 'grid-2' | 'grid-3' | 'grid-4' | 'full' | 'split';
  contract?: Record<string, any>;
  props?: Record<string, any>;
  css?: Record<string, string | number>;
  responsive?: {
    mobile?: Record<string, any>;
    tablet?: Record<string, any>;
  };
  bindings?: Record<string, Binding>;
  actions?: Record<string, ActionRef>;
  children?: UINode[];
};

// ── 3. Route Contract ────────────────────────────────────────────────

export const UIRouteSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1), // e.g. "/", "/catalog", "/product/:id", "/cart"
  title: z.string().optional(),
  nodes: z.array(UINodeSchema),
});

export type UIRoute = z.infer<typeof UIRouteSchema>;

// ── 4. DesignTokens Contract (Google DESIGN.md Compliant) ────────────

export const DesignTokensSchema = z.object({
  name: z.string().default('TAR Storefront'),
  preset: z.string().optional(),
  colors: z.object({
    primary: z.string().default('#18181B'),
    secondary: z.string().default('#475569'),
    tertiary: z.string().default('#D4AF37'),
    background: z.string().default('#FAFAFA'),
    surface: z.string().default('#FFFFFF'),
    text: z.string().default('#0F172A'),
    muted: z.string().default('#64748B'),
    border: z.string().default('rgba(0,0,0,0.08)'),
  }),
  typography: z.object({
    fontHeading: z.string().default('Outfit'),
    fontBody: z.string().default('Inter'),
    headingWeight: z.string().default('700'),
    bodyWeight: z.string().default('400'),
  }),
  radii: z.object({
    sm: z.string().default('6px'),
    md: z.string().default('12px'),
    lg: z.string().default('16px'),
    full: z.string().default('9999px'),
  }),
  spacing: z.object({
    xs: z.string().default('4px'),
    sm: z.string().default('8px'),
    md: z.string().default('16px'),
    lg: z.string().default('24px'),
    xl: z.string().default('48px'),
  }),
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;

// ── 5. UIPlan Top-Level Contract ─────────────────────────────────────

export const UIPlanSchema = z.object({
  workspaceId: z.string().min(1),
  revision: z.string().min(1),
  target: z.enum(['web', 'native']).default('web'),
  designTokens: DesignTokensSchema,
  routes: z.array(UIRouteSchema).min(1),
  createdAt: z.string().optional(),
});

export type UIPlan = z.infer<typeof UIPlanSchema>;

// ── 6. Revision Pointer Contract ─────────────────────────────────────

export interface UIRevision {
  id: string;
  workspaceId: string;
  revision: string;
  plan: UIPlan;
  status: 'draft' | 'approved' | 'active' | 'archived';
  createdAt: string;
}

// ── Helper: Validate UIPlan ──────────────────────────────────────────

export function validateUIPlan(data: unknown): UIPlan | null {
  const result = UIPlanSchema.safeParse(data);
  return result.success ? result.data : null;
}
