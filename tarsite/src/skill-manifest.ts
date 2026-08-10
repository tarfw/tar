/**
 * tarsite — Capability-Based Skill Contract (Phase 3)
 * Registers specialized AI design skills and maps capabilities to component requirements.
 */

import { z } from 'zod';

export const SkillManifestSchema = z.object({
  skillId: z.string().min(1),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()), // e.g. ["layout.compose", "data.bind", "checkout.integrate"]
  requires: z.object({
    components: z.array(z.string()),
    resources: z.array(z.string()),
  }),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

// Registered System Skills
export const SYSTEM_SKILL_REGISTRY: Record<string, SkillManifest> = {
  'storefront-designer': {
    skillId: 'storefront-designer',
    name: 'E-Commerce Storefront Designer',
    description: 'Generates product grids, feature heroes, cart sliders, and sticky checkout widgets.',
    capabilities: ['layout.compose', 'data.bind', 'checkout.integrate'],
    requires: {
      components: ['hero_banner', 'product_grid', 'cart_widget', 'contact_form', 'footer'],
      resources: ['matter.product'],
    },
  },
  'restaurant-menu-designer': {
    skillId: 'restaurant-menu-designer',
    name: 'Artisan Cafe & Restaurant Designer',
    description: 'Generates category menus, opening hours, booking widgets, and chef stories.',
    capabilities: ['layout.compose', 'data.bind', 'booking.integrate'],
    requires: {
      components: ['hero_banner', 'menu_grid', 'hours_card', 'booking_form', 'footer'],
      resources: ['matter.menu_item'],
    },
  },
  'saas-notion-designer': {
    skillId: 'saas-notion-designer',
    name: 'Productivity & SaaS Designer',
    description: 'Generates paper-soft Notion canvas, features bento, customer reviews, and pricing tables.',
    capabilities: ['layout.compose', 'saas.present'],
    requires: {
      components: ['announcement_bar', 'hero_banner', 'feature_grid', 'testimonials', 'footer'],
      resources: [],
    },
  },
};

export function getSkillForIntent(intent: string): SkillManifest {
  const clean = intent.toLowerCase();
  if (clean.includes('cafe') || clean.includes('bakery') || clean.includes('restaurant') || clean.includes('menu')) {
    return SYSTEM_SKILL_REGISTRY['restaurant-menu-designer'];
  }
  if (clean.includes('notion') || clean.includes('saas') || clean.includes('workspace') || clean.includes('tech')) {
    return SYSTEM_SKILL_REGISTRY['saas-notion-designer'];
  }
  return SYSTEM_SKILL_REGISTRY['storefront-designer'];
}
