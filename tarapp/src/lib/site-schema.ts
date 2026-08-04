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

export interface WidgetConfig {
  type: 'cart' | 'booking' | 'contact' | 'tracking' | 'quote' | 'chat';
  config: Record<string, any>;
}

export interface SiteLayout {
  template: TemplateName;
  theme: Theme;
  sections: Section[];
  widgets?: WidgetConfig[];
}

export const DEFAULT_THEME: Theme = {
  primary: '#5E6AD2',
  background: '#ffffff',
  text: '#111111',
  font: 'Inter',
  fontHeading: 'Inter',
};

export const DEFAULT_LAYOUT: SiteLayout = {
  template: 'streetwear-dark',
  theme: { ...DEFAULT_THEME, primary: '#5E6AD2', background: '#111111', text: '#ffffff' },
  sections: [
    { id: 'hero', type: 'hero', config: { headline: 'Welcome', subtext: 'Discover our workspace', cta: 'Explore' } },
    { id: 'footer', type: 'footer', config: { text: 'All rights reserved' } },
  ],
};

export function parseLayout(value: unknown): SiteLayout | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const sections = Array.isArray(obj.sections)
    ? obj.sections
    : Array.isArray((obj as any).routes?.[0]?.nodes)
    ? (obj as any).routes[0].nodes
    : null;
  if (!sections) return null;

  return {
    template: (typeof obj.template === 'string' ? obj.template : 'streetwear-dark') as TemplateName,
    theme: (obj.theme && typeof obj.theme === 'object' ? obj.theme : DEFAULT_THEME) as Theme,
    sections: sections as Section[],
    widgets: (Array.isArray(obj.widgets) ? obj.widgets : []) as WidgetConfig[],
  };
}

export function sectionSummary(section: Section): string {
  const c: Record<string, any> = { ...(section.config || {}), ...(section as any) };
  switch (section.type) {
    case 'hero':
    case 'hero_banner':
      return c.headline || c.title ? String(c.headline || c.title) : 'Hero banner';
    case 'hero_carousel':
      return `${(c.slides ?? []).length || 1}-slide carousel`;
    case 'product_grid':
      return c.title ? `Products · ${c.title}` : 'Product grid';
    case 'menu_grid':
      return c.title ? `Menu · ${c.title}` : 'Menu grid';
    case 'service_list':
      return c.title ? `Services · ${c.title}` : 'Services list';
    case 'booking_calendar':
      return `Booking Calendar`;
    case 'product_carousel':
      return 'Scrollable products';
    case 'lookbook_grid':
      return `${(c.images ?? []).length || 0}-image lookbook`;
    case 'testimonials':
      return `${(c.items ?? c.quotes ?? []).length || 0} testimonials`;
    case 'newsletter':
      return c.headline || c.title ? String(c.headline || c.title) : 'Newsletter';
    case 'promo_tiles':
      return `${(c.tiles ?? []).length || 0} promo tiles`;
    case 'category_row':
      return `${(c.categories ?? []).length || 0} categories`;
    case 'rich_text':
      return c.text || c.body ? String(c.text || c.body).slice(0, 40) + '…' : 'Rich text';
    case 'brand_story':
      return c.heading || c.title ? String(c.heading || c.title) : 'Brand story';
    case 'social_proof':
      return c.metric || c.stats ? 'Social proof metrics' : 'Social proof';
    case 'countdown':
      return c.label ? String(c.label) : 'Countdown';
    case 'section_header':
      return c.title ? String(c.title) : 'Section header';
    case 'announcement_bar':
      return c.text || c.title ? String(c.text || c.title) : 'Announcement bar';
    case 'hours':
      return c.title || c.hours ? String(c.title || c.hours) : 'Operating hours';
    case 'contact_form':
      return c.title ? String(c.title) : 'Contact form';
    case 'footer':
      return c.text ? String(c.text) : 'Footer';
    default:
      return c.title || c.headline || String(section.type).replace(/_/g, ' ');
  }
}
