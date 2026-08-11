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
  kith: {
    name: 'KITH Streetwear & Lifestyle',
    preset: 'kith',
    colors: {
      primary: '#000000',
      secondary: '#E5E5E5',
      tertiary: '#000000',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#000000',
      muted: '#999999',
      border: 'rgba(0,0,0,0.1)',
    },
    typography: {
      fontHeading: 'Inter',
      fontBody: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '0px', md: '0px', lg: '0px', full: '0px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  milo: {
    name: 'Milo Pet Care & Insurance',
    preset: 'milo',
    colors: {
      primary: '#1FCB60',
      secondary: '#032E1C',
      tertiary: '#B5EB79',
      background: '#FAF7F2',
      surface: '#FFFFFF',
      text: '#032E1C',
      muted: '#64748B',
      border: 'rgba(3,46,28,0.08)',
    },
    typography: {
      fontHeading: 'Marcellus',
      fontBody: 'Montserrat',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '8px', md: '20px', lg: '24px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
};

export function getPresetDesignTokens(hint?: string, name?: string): DesignTokens {
  const matched = hint ? PRESET_TOKENS[hint] : PRESET_TOKENS['milo'];
  const base = matched || PRESET_TOKENS['milo'];
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
