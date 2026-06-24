/**
 * Storefront types — shared with phone app.
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

export interface StorefrontProduct {
  name: string;
  price: number | null;
  imageUrl?: string;
  variants?: string[];
  modifiers?: string[];
}
