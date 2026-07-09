import { z } from 'zod';

// ── DESIGN.md Schema ────────────────────────────────────────────────
export const DesignTokensSchema = z.object({
  name: z.string().min(1),
  version: z.string().default('1.0.0'),
  colors: z.record(z.string(), z.string()),
  typography: z.record(
    z.string(),
    z.object({
      fontFamily: z.string(),
      fontSize: z.string(),
      fontWeight: z.number(),
    })
  ),
  rounded: z.record(z.string(), z.string()),
  spacing: z.record(z.string(), z.string()),
  components: z.record(z.string(), z.record(z.string(), z.string())),
});

// ── SKILL.md Schema ─────────────────────────────────────────────────
export const ParamDefSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'number', 'select']),
  required: z.boolean(),
});

export const ActionStepSchema = z.object({
  tool: z.string(),
  table: z.string().optional(),
  type: z.string().optional(),
  params: z.record(z.string(), z.string()),
  raw: z.string(),
});

export const ParsedActionSchema = z.object({
  name: z.string().min(1),
  module: z.string(),
  purpose: z.string(),
  intents: z.array(z.string()),
  params: z.array(ParamDefSchema),
  steps: z.array(ActionStepSchema),
});

export const ParsedSkillSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  tools: z.array(z.string()),
  actions: z.array(ParsedActionSchema),
});

// ── site/pages.md Schema ───────────────────────────────────────────
export const SitePageSchema = z.object({
  slug: z.string().startsWith('/'),
  template: z.enum([
    'hero',
    'catalog-grid',
    'item-detail',
    'cart',
    'checkout',
    'booking-widget',
    'contact',
  ]),
  data_source: z.string(),
  module: z.string(),
});

export const SitePagesConfigSchema = z.object({
  pages: z.array(SitePageSchema),
});

// ── Validation Helpers ──────────────────────────────────────────────

export function validateDesignTokens(data: unknown) {
  return DesignTokensSchema.safeParse(data);
}

export function validateSkill(data: unknown) {
  return ParsedSkillSchema.safeParse(data);
}

export function validateSitePages(data: unknown) {
  return SitePagesConfigSchema.safeParse(data);
}
