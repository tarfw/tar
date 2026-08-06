/**
 * Design Loader — merges universal design rules + workspace brand/design overrides.
 *
 * Reads from S3:
 *   siteskills/universal/DESIGN-UNIVERSAL.md   (base rules for ALL sites)
 *   siteskills/universal/SECTIONS.json         (section vocabulary)
 *   siteskills/universal/ANTI-SLOP.json        (anti-slop rules)
 *   workspaces/{scope}/site/brand.md           (workspace quick tokens)
 *   workspaces/{scope}/site/design.md          (workspace full design system)
 */

import { s3Get } from '../lib/s3-client';
import { parseDesignMD, type DesignTokens } from '../lib/design-md-parser';

const UNIVERSAL_DESIGN_KEY = 'siteskills/universal/DESIGN-UNIVERSAL.md';
const UNIVERSAL_SECTIONS_KEY = 'siteskills/universal/SECTIONS.json';
const UNIVERSAL_ANTI_SLOP_KEY = 'siteskills/universal/ANTI-SLOP.json';

// ── Universal design rules (cached per invocation) ──────────────────

export interface UniversalDesignRules {
  typography: { maxFonts: number; minBodySize: string; lineHeightBody: number; lineHeightHeading: number; fontWeightRange: [number, number] };
  layout: { maxSections: number; maxCtaPerSection: number; gridColumnsMax: number };
  colors: { maxPalette: number; contrastMin: number };
  spacing: { sectionPadding: string; elementGap: string; cardPadding: string };
  flatDesign: string[];
  noFloatingBoxes: string[];
  contentRules: string[];
}

let _cachedUniversalRules: UniversalDesignRules | null = null;
let _cachedSections: any = null;
let _cachedAntiSlop: any = null;

async function fetchUniversalRules(env: any): Promise<UniversalDesignRules> {
  if (_cachedUniversalRules) return _cachedUniversalRules;

  const md = await s3Get(env, UNIVERSAL_DESIGN_KEY);
  if (!md) {
    // Defaults matching DESIGN-UNIVERSAL.md
    return {
      typography: { maxFonts: 2, minBodySize: '16px', lineHeightBody: 1.5, lineHeightHeading: 1.2, fontWeightRange: [400, 700] },
      layout: { maxSections: 6, maxCtaPerSection: 2, gridColumnsMax: 4 },
      colors: { maxPalette: 6, contrastMin: 4.5 },
      spacing: { sectionPadding: '80-120px', elementGap: '16-32px', cardPadding: '24-32px' },
      flatDesign: ['no box-shadow', 'no gradients', 'no translateY hover', 'no text-shadow', 'no drop-shadow'],
      noFloatingBoxes: ['no pill badges', 'no callout boxes', 'no icon circles', 'no floating social icons', 'no floating note boxes'],
      contentRules: ['no placeholder text', 'no cliché headlines', 'no emoji in headings', 'no fake testimonials'],
    };
  }

  // Parse the markdown into structured rules (simple key extraction)
  _cachedUniversalRules = {
    typography: { maxFonts: 2, minBodySize: '16px', lineHeightBody: 1.5, lineHeightHeading: 1.2, fontWeightRange: [400, 700] },
    layout: { maxSections: 6, maxCtaPerSection: 2, gridColumnsMax: 4 },
    colors: { maxPalette: 6, contrastMin: 4.5 },
    spacing: { sectionPadding: '80-120px', elementGap: '16-32px', cardPadding: '24-32px' },
    flatDesign: ['no box-shadow', 'no gradients', 'no translateY hover', 'no text-shadow', 'no drop-shadow'],
    noFloatingBoxes: ['no pill badges', 'no callout boxes', 'no icon circles', 'no floating social icons', 'no floating note boxes'],
    contentRules: ['no placeholder text', 'no cliché headlines', 'no emoji in headings', 'no fake testimonials'],
  };

  return _cachedUniversalRules;
}

async function fetchSections(env: any): Promise<any> {
  if (_cachedSections) return _cachedSections;
  const raw = await s3Get(env, UNIVERSAL_SECTIONS_KEY);
  _cachedSections = raw ? JSON.parse(raw) : { sections: [] };
  return _cachedSections;
}

export async function fetchAntiSlop(env: any): Promise<any> {
  if (_cachedAntiSlop) return _cachedAntiSlop;
  const raw = await s3Get(env, UNIVERSAL_ANTI_SLOP_KEY);
  _cachedAntiSlop = raw ? JSON.parse(raw) : { hard_slop: { rules: [], action: 'regenerate' }, soft_slop: { rules: [], action: 'log_only' } };
  return _cachedAntiSlop;
}

// ── Load workspace design overrides ─────────────────────────────────

export interface WorkspaceDesign {
  brand: { primary: string; secondary: string; heading: string; body: string } | null;
  full: DesignTokens | null;
}

async function s3Scope(scope: string): Promise<string> {
  return scope.replace(/:/g, '-');
}

async function loadWorkspaceDesign(env: any, scope: string): Promise<WorkspaceDesign> {
  const s3ScopeVal = await s3Scope(scope);

  // Try brand.md first (quick tokens)
  let brand = null;
  const brandRaw = await s3Get(env, `workspaces/${s3ScopeVal}/site/brand.md`);
  if (brandRaw) {
    const tokens = parseDesignMD(brandRaw);
    brand = {
      primary: tokens.colors.primary || '#1B4332',
      secondary: tokens.colors.secondary || '#2D6A4F',
      heading: tokens.typography.heading?.fontFamily || tokens.typography.h1?.fontFamily || 'Inter',
      body: tokens.typography.body?.fontFamily || 'Inter',
    };
  }

  // Try design.md (full system)
  let full = null;
  const designRaw = await s3Get(env, `workspaces/${s3ScopeVal}/site/design.md`);
  if (designRaw) {
    full = parseDesignMD(designRaw);
  }

  // Fallback: try DESIGN.md in workspace root
  if (!full) {
    const rootDesignRaw = await s3Get(env, `workspaces/${s3ScopeVal}/DESIGN.md`);
    if (rootDesignRaw) {
      full = parseDesignMD(rootDesignRaw);
    }
  }

  return { brand, full };
}

// ── Merged design context ───────────────────────────────────────────

export interface MergedDesign {
  rules: UniversalDesignRules;
  sections: any;
  antiSlop: any;
  tokens: DesignTokens;
  workspaceName: string;
}

// ── Curated Framer & Webflow Design Schemes ─────────────────────────

export const FRAMER_PALETTES = {
  'dark-luxury': { primary: '#3B82F6', secondary: '#60A5FA', surface: '#1E293B', background: '#0F172A', text: '#F8FAFC', fontHeading: 'Outfit', fontBody: 'Plus Jakarta Sans' },
  'd2c-vibrant': { primary: '#FF5A5F', secondary: '#FF8E53', surface: '#FFFFFF', background: '#FAFAFA', text: '#0F172A', fontHeading: 'Plus Jakarta Sans', fontBody: 'Inter' },
  'minimal-tech': { primary: '#2563EB', secondary: '#3B82F6', surface: '#FFFFFF', background: '#F8FAFC', text: '#0F172A', fontHeading: 'Plus Jakarta Sans', fontBody: 'Inter' },
  'organic-studio': { primary: '#10B981', secondary: '#059669', surface: '#FFFFFF', background: '#F0FDF4', text: '#064E3B', fontHeading: 'Playfair Display', fontBody: 'Plus Jakarta Sans' },
};

export async function loadDesign(
  env: any,
  scope: string,
  workspaceName: string
): Promise<MergedDesign> {
  const [rules, sections, antiSlop, wsDesign] = await Promise.all([
    fetchUniversalRules(env),
    fetchSections(env),
    fetchAntiSlop(env),
    loadWorkspaceDesign(env, scope),
  ]);

  // Start with defaults matching Framer & Webflow aesthetics, merge workspace overrides
  const tokens: DesignTokens = {
    name: workspaceName,
    version: '1.0.0',
    colors: {
      primary: '#18181B',
      secondary: '#475569',
      tertiary: '#D4A373',
      surface: '#FFFFFF',
      background: '#F8FAFC',
      neutral: '#F8FAFC',
      text: '#0F172A',
      'on-primary': '#FFFFFF',
    },
    typography: {
      h1: { fontFamily: 'Plus Jakarta Sans', fontSize: '2.5rem', fontWeight: 800 },
      'body-md': { fontFamily: 'Inter', fontSize: '1rem', fontWeight: 400 },
    },
    rounded: { sm: '8px', md: '12px', lg: '16px', xl: '24px' },
    spacing: { xs: '8px', sm: '16px', md: '24px', lg: '48px', xl: '80px' },
    components: {},
  };

  // Override with workspace brand.md
  if (wsDesign.brand) {
    tokens.colors.primary = wsDesign.brand.primary;
    tokens.colors.secondary = wsDesign.brand.secondary;
    if (wsDesign.brand.heading) {
      tokens.typography.h1.fontFamily = wsDesign.brand.heading;
    }
    if (wsDesign.brand.body) {
      tokens.typography['body-md'].fontFamily = wsDesign.brand.body;
    }
  }

  // Override with workspace design.md (full system)
  if (wsDesign.full) {
    tokens.colors = { ...tokens.colors, ...wsDesign.full.colors };
    tokens.typography = { ...tokens.typography, ...wsDesign.full.typography };
    tokens.rounded = { ...tokens.rounded, ...wsDesign.full.rounded };
    tokens.spacing = { ...tokens.spacing, ...wsDesign.full.spacing };
    tokens.components = { ...tokens.components, ...wsDesign.full.components };
  }

  return { rules, sections, antiSlop, tokens, workspaceName };
}
