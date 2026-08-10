/**
 * tarsite — Standardized DesignTokens & CSS Skins (Phase 9)
 * Decouples theme styling entirely from layout structures.
 * Generates CSS Custom Properties for Google DESIGN.md specs.
 * Includes dynamic Markdown parser for DESIGN.md files.
 */

import { type DesignTokens } from './types';

/**
 * Dynamic Markdown Parser — converts any DESIGN.md text content into DesignTokens automatically
 */
export function parseDesignMarkdown(mdContent: string, presetSlug?: string): DesignTokens {
  const getMatch = (regex: RegExp, fallback: string): string => {
    const match = mdContent.match(regex);
    return match ? match[1].trim() : fallback;
  };

  const name = getMatch(/-\s*\*?Name\*?:\s*([^\n]+)/i, 'Custom Design');
  const bg = getMatch(/-\s*\*?Background\*?:\s*`?([^`\n]+)`?/i, '#FFFFFF');
  const surface = getMatch(/-\s*\*?Surface\*?:\s*`?([^`\n]+)`?/i, '#FFFFFF');
  const text = getMatch(/-\s*\*?Text\*?:\s*`?([^`\n]+)`?/i, '#111111');
  const muted = getMatch(/-\s*\*?Muted\*?:\s*`?([^`\n]+)`?/i, '#666666');
  const primary = getMatch(/-\s*\*?Primary\*?:\s*`?([^`\n]+)`?/i, '#000000');
  const secondary = getMatch(/-\s*\*?Secondary\*?:\s*`?([^`\n]+)`?/i, '#333333');
  const border = getMatch(/-\s*\*?Border\*?:\s*`?([^`\n]+)`?/i, 'rgba(0,0,0,0.1)');

  const fontHeading = getMatch(/-\s*\*?Heading Font\*?:\s*`?([^`\n]+)`?/i, 'Inter');
  const fontBody = getMatch(/-\s*\*?Body Font\*?:\s*`?([^`\n]+)`?/i, 'Inter');
  const headingWeight = getMatch(/-\s*\*?Heading Weight\*?:\s*`?([^`\n]+)`?/i, '700');
  const bodyWeight = getMatch(/-\s*\*?Body Weight\*?:\s*`?([^`\n]+)`?/i, '400');

  const radiusSm = getMatch(/-\s*\*?Border Radius Small\*?:\s*`?([^`\n]+)`?/i, '4px');
  const radiusMd = getMatch(/-\s*\*?Border Radius Medium\*?:\s*`?([^`\n]+)`?/i, '8px');
  const radiusLg = getMatch(/-\s*\*?Border Radius Large\*?:\s*`?([^`\n]+)`?/i, '12px');
  const radiusFull = getMatch(/-\s*\*?Border Radius Full\*?:\s*`?([^`\n]+)`?/i, '9999px');

  return {
    name,
    preset: presetSlug || 'custom',
    colors: {
      primary,
      secondary,
      tertiary: primary,
      background: bg,
      surface,
      text,
      muted,
      border,
    },
    typography: {
      fontHeading: fontHeading.replace(/['"]/g, '').split(',')[0],
      fontBody: fontBody.replace(/['"]/g, '').split(',')[0],
      headingWeight,
      bodyWeight,
    },
    radii: {
      sm: radiusSm,
      md: radiusMd,
      lg: radiusLg,
      full: radiusFull,
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '48px',
    },
  };
}

export const PRESET_TOKENS: Record<string, DesignTokens> = {
  notion: {
    name: 'Notion Workspace',
    preset: 'notion',
    colors: {
      primary: '#0075DE',
      secondary: '#213183',
      tertiary: '#0075DE',
      background: '#F6F5F4',
      surface: '#FFFFFF',
      text: '#000000',
      muted: '#666666',
      border: 'rgba(0,0,0,0.06)',
    },
    typography: {
      fontHeading: 'Inter',
      fontBody: 'Inter',
      headingWeight: '600',
      bodyWeight: '400',
    },
    radii: { sm: '4px', md: '8px', lg: '12px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  lululemon: {
    name: 'Lululemon Activewear',
    preset: 'lululemon',
    colors: {
      primary: '#D31334',
      secondary: '#111111',
      tertiary: '#D31334',
      background: '#FFFFFF',
      surface: '#F7F7F7',
      text: '#111111',
      muted: '#666666',
      border: 'rgba(0,0,0,0.12)',
    },
    typography: {
      fontHeading: 'Inter',
      fontBody: 'Inter',
      headingWeight: '800',
      bodyWeight: '400',
    },
    radii: { sm: '0px', md: '0px', lg: '0px', full: '0px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  'luxury-black': {
    name: 'Luxury Dark',
    preset: 'luxury-black',
    colors: {
      primary: '#D4AF37',
      secondary: '#3F3F46',
      tertiary: '#D4AF37',
      background: '#09090B',
      surface: '#18181B',
      text: '#FAFAFA',
      muted: '#A1A1AA',
      border: 'rgba(255,255,255,0.12)',
    },
    typography: {
      fontHeading: 'Playfair Display',
      fontBody: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '6px', md: '12px', lg: '20px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  'minimal-clean': {
    name: 'Minimal Clean',
    preset: 'minimal-clean',
    colors: {
      primary: '#5E6AD2',
      secondary: '#0F172A',
      tertiary: '#5E6AD2',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#64748B',
      border: 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontHeading: 'Outfit',
      fontBody: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '6px', md: '12px', lg: '16px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  aesop: {
    name: 'Aesop Earth Tones',
    preset: 'aesop',
    colors: {
      primary: '#332E2B',
      secondary: '#8C6D53',
      tertiary: '#8C6D53',
      background: '#F7F3E9',
      surface: '#EFEBE0',
      text: '#222222',
      muted: '#777777',
      border: 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontHeading: 'Playfair Display',
      fontBody: 'Inter',
      headingWeight: '600',
      bodyWeight: '400',
    },
    radii: { sm: '4px', md: '6px', lg: '10px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
};

export function getPresetDesignTokens(hint?: string, name?: string): DesignTokens {
  const matched = hint ? PRESET_TOKENS[hint] : PRESET_TOKENS['minimal-clean'];
  const base = matched || PRESET_TOKENS['minimal-clean'];
  return { ...base, name: name || base.name };
}

export function compileCssVars(tokens: DesignTokens): string {
  const c = tokens.colors;
  const t = tokens.typography;
  const r = tokens.radii;
  const s = tokens.spacing;

  return `
    :root {
      --color-primary: ${c.primary};
      --color-secondary: ${c.secondary};
      --color-tertiary: ${c.tertiary};
      --color-background: ${c.background};
      --color-surface: ${c.surface};
      --color-text: ${c.text};
      --color-muted: ${c.muted};
      --color-border: ${c.border};

      --font-heading: "${t.fontHeading}", sans-serif;
      --font-body: "${t.fontBody}", sans-serif;
      --font-weight-heading: ${t.headingWeight};
      --font-weight-body: ${t.bodyWeight};

      --radius-sm: ${r.sm};
      --radius-md: ${r.md};
      --radius-lg: ${r.lg};
      --radius-full: ${r.full};

      --space-xs: ${s.xs};
      --space-sm: ${s.sm};
      --space-md: ${s.md};
      --space-lg: ${s.lg};
      --space-xl: ${s.xl};
    }
  `;
}
