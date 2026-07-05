/**
 * Storefront layout — template + CSS variables + sections.
 *
 * The AI picks a template and generates a config. The Worker renders
 * the template with the config. Simple edits change config only (~200 tokens).
 * Structural edits add/remove sections (~400 tokens). Custom designs regenerate everything (~4000 tokens).
 */

export const TEMPLATES = [
  'streetwear-dark',
  'luxury-black',
  'minimal-white',
  'modern-gradient',
  'editorial',
] as const;
export type TemplateName = typeof TEMPLATES[number];

export interface Theme {
  primary: string;
  background: string;
  text: string;
  font: string;
  fontHeading: string;
}

export interface Section {
  id: string;
  type: string;
  config: Record<string, any>;
}

export interface StorefrontLayout {
  template: TemplateName;
  theme: Theme;
  sections: Section[];
}

export const DEFAULT_THEME: Theme = {
  primary: '#5E6AD2',
  background: '#ffffff',
  text: '#111111',
  font: 'Inter',
  fontHeading: 'Inter',
};

export const DEFAULT_LAYOUT: StorefrontLayout = {
  template: 'streetwear-dark',
  theme: { ...DEFAULT_THEME, primary: '#5E6AD2', background: '#111111', text: '#ffffff' },
  sections: [
    { id: 'hero', type: 'hero', config: { headline: 'Welcome', subtext: 'Discover our latest collection', cta: 'Shop Now' } },
    { id: 'products', type: 'product_grid', config: { columns: 2, title: 'Products' } },
    { id: 'footer', type: 'footer', config: { text: 'All rights reserved' } },
  ],
};

/**
 * Validate an arbitrary value into a StorefrontLayout.
 */
export function parseLayout(value: unknown): StorefrontLayout | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.template !== 'string') return null;
  if (!obj.theme || typeof obj.theme !== 'object') return null;
  if (!Array.isArray(obj.sections)) return null;
  return value as StorefrontLayout;
}

/** A short human-readable summary of a section, for the preview list. */
export function sectionSummary(section: Section): string {
  const c = section.config || {};
  switch (section.type) {
    case 'hero': return c.headline ? String(c.headline) : 'Hero section';
    case 'hero_carousel': return `${(c.slides ?? []).length || 1}-slide carousel`;
    case 'product_grid': return `${c.columns ?? 2}-column products · ${c.title || 'Products'}`;
    case 'product_carousel': return 'Scrollable products';
    case 'lookbook_grid': return `${(c.images ?? []).length || 0}-image lookbook`;
    case 'testimonials': return `${(c.items ?? []).length || 0} testimonials`;
    case 'newsletter': return c.headline ? String(c.headline) : 'Newsletter';
    case 'promo_tiles': return `${(c.tiles ?? []).length || 0} promo tiles`;
    case 'category_row': return `${(c.categories ?? []).length || 0} categories`;
    case 'rich_text': return c.text ? String(c.text).slice(0, 40) + '…' : 'Rich text';
    case 'brand_story': return c.heading ? String(c.heading) : 'Brand story';
    case 'social_proof': return c.metric ? String(c.metric) : 'Social proof';
    case 'countdown': return c.label ? String(c.label) : 'Countdown';
    case 'section_header': return c.title ? String(c.title) : 'Section header';
    case 'announcement_bar': return c.text ? String(c.text) : 'Announcement';
    case 'footer': return c.text ? String(c.text) : 'Footer';
    default: return section.type;
  }
}
