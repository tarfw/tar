/**
 * tarsite — Standardized DesignTokens & CSS Skins
 * Generates CSS Custom Properties for DESIGN.md specs.
 * Includes dynamic Markdown parser for DESIGN.md files and tables.
 */

import { type DesignTokens } from './types';

/**
 * Dynamic Markdown Parser — converts any DESIGN.md text content or Refero markdown table into DesignTokens
 */
export function parseDesignMarkdown(mdContent: string, presetSlug?: string): DesignTokens {
  const getMatch = (regex: RegExp, fallback: string): string => {
    const match = mdContent.match(regex);
    return match ? match[1].trim() : fallback;
  };

  const getTableColor = (name: string, fallback: string): string => {
    const regex = new RegExp(`\\|\\s*${name}\\s*\\|\\s*([#a-fA-F0-9]+)\\s*\\|`, 'i');
    const match = mdContent.match(regex);
    return match ? match[1].trim() : fallback;
  };

  const name = getMatch(/#\s*([^\n—\-]+)/i, getMatch(/-\s*\*?Name\*?:\s*([^\n]+)/i, 'Storefront'));
  
  // Refero table color extraction with fallback to key-value
  const primary = getTableColor('Obsidian', getTableColor('Primary', getMatch(/primary:\s*["']?([^"'\n]+)["']?/i, '#000000')));
  const bg = getTableColor('Paper White', getTableColor('Background', getMatch(/background:\s*["']?([^"'\n]+)["']?/i, '#FFFFFF')));
  const surface = getTableColor('Surface', getMatch(/surface:\s*["']?([^"'\n]+)["']?/i, '#F8F8F7'));
  const text = getTableColor('Deep Ink', getTableColor('Text', getMatch(/text:\s*["']?([^"'\n]+)["']?/i, '#121211')));
  const muted = getTableColor('Graphite', getTableColor('Muted', getMatch(/muted:\s*["']?([^"'\n]+)["']?/i, '#575551')));
  const secondary = getTableColor('Warm Stone', getTableColor('Secondary', getMatch(/secondary:\s*["']?([^"'\n]+)["']?/i, '#958D7E')));
  const accent = getTableColor('Ember Tag', getTableColor('Accent', getMatch(/accent:\s*["']?([^"'\n]+)["']?/i, '#E8552B')));
  const border = getMatch(/border:\s*["']?([^"'\n]+)["']?/i, 'rgba(0,0,0,0.08)');

  const fontHeading = getMatch(/fontHeading:\s*["']?([^"'\n]+)["']?/i, 'Inter');
  const fontBody = getMatch(/fontBody:\s*["']?([^"'\n]+)["']?/i, 'Inter');

  const cardRadius = getMatch(/card:\s*["']?([^"'\n]+)["']?/i, getMatch(/cardRadius:\s*["']?([^"'\n]+)["']?/i, '4px'));
  const buttonRadius = getMatch(/button:\s*["']?([^"'\n]+)["']?/i, getMatch(/buttonRadius:\s*["']?([^"'\n]+)["']?/i, '4px'));

  return {
    name,
    preset: presetSlug || 'custom',
    colors: {
      primary,
      secondary,
      tertiary: accent,
      background: bg,
      surface,
      text,
      muted,
      border,
    },
    typography: {
      fontHeading: fontHeading.replace(/['"]/g, '').split(',')[0],
      fontBody: fontBody.replace(/['"]/g, '').split(',')[0],
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: {
      sm: '4px',
      md: cardRadius,
      lg: '12px',
      full: buttonRadius === '999px' || buttonRadius === '9999px' ? '9999px' : buttonRadius,
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
  planhat: {
    name: 'Planhat Tech',
    preset: 'planhat',
    colors: {
      primary: '#000000',
      secondary: '#958D7E',
      tertiary: '#E8552B',
      background: '#FFFFFF',
      surface: '#F8F8F7',
      text: '#121211',
      muted: '#575551',
      border: 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontHeading: 'Inter',
      fontBody: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '4px', md: '4px', lg: '8px', full: '4px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
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
      fontHeading: 'Outfit',
      fontBody: 'Inter',
      headingWeight: '700',
      bodyWeight: '400',
    },
    radii: { sm: '8px', md: '16px', lg: '24px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  },
  eql: {
    name: 'EQL Launch & Hype Drop',
    preset: 'eql',
    colors: {
      primary: '#0A0A0C',
      secondary: '#FFE600',
      tertiary: '#FFF6C7',
      background: '#FFFFFF',
      surface: '#F4F4F6',
      text: '#0A0A0C',
      muted: '#6B7280',
      border: 'rgba(10,10,12,0.1)',
    },
    typography: {
      fontHeading: 'Plus Jakarta Sans',
      fontBody: 'Inter',
      headingWeight: '800',
      bodyWeight: '500',
    },
    radii: { sm: '6px', md: '12px', lg: '16px', full: '9999px' },
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
