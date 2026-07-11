/**
 * Component catalog — defines every valid UI component type.
 * AI must only reference types present in this catalog.
 */

import { z } from 'zod';
import type { ComponentCatalogEntry } from './types';

// ── Prop schemas per component type ─────────────────────────────────

export const MetricCardPropsSchema = z.object({
  title: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  icon: z.string().optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
});

export const DataTablePropsSchema = z.object({
  title: z.string().optional(),
  columns: z.array(z.string()).optional(),
  emptyMessage: z.string().optional(),
});

export const CatalogGridPropsSchema = z.object({
  title: z.string().optional(),
  columns: z.number().min(1).max(4).optional(),
  emptyMessage: z.string().optional(),
});

export const BookingGridPropsSchema = z.object({
  title: z.string().optional(),
  slotsPerRow: z.number().min(1).max(6).optional(),
});

export const TimelineFeedPropsSchema = z.object({
  title: z.string().optional(),
  maxItems: z.number().optional(),
});

export const QuickActionsPropsSchema = z.object({
  title: z.string().optional(),
  layout: z.enum(['grid', 'list', 'horizontal']).optional(),
});

export const ContentCardPropsSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaAction: z.string().optional(),
});

export const HeroPropsSchema = z.object({
  headline: z.string().optional(),
  subtext: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaAction: z.string().optional(),
  backgroundImage: z.string().optional(),
});

export const ContactFormPropsSchema = z.object({
  title: z.string().optional(),
  fields: z.array(z.string()).optional(),
  submitLabel: z.string().optional(),
});

export const CheckoutFormPropsSchema = z.object({
  title: z.string().optional(),
  showCartSummary: z.boolean().optional(),
});

export const MenuGridPropsSchema = z.object({
  title: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export const ServiceListPropsSchema = z.object({
  title: z.string().optional(),
  showPricing: z.boolean().optional(),
});

export const AnnouncementBarPropsSchema = z.object({
  text: z.string().optional(),
  link: z.string().optional(),
  bgColor: z.string().optional(),
});

export const FooterPropsSchema = z.object({
  links: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
  copyright: z.string().optional(),
});

export const GalleryPropsSchema = z.object({
  title: z.string().optional(),
  columns: z.number().min(1).max(4).optional(),
});

// ── Component catalog ───────────────────────────────────────────────

export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  // Native components
  {
    type: 'metric-card',
    label: 'Metric Card',
    icon: 'trending-up-outline',
    description: 'Displays a single stat or metric with optional trend',
    propsSchema: MetricCardPropsSchema,
  },
  {
    type: 'data-table',
    label: 'Data Table',
    icon: 'list-outline',
    description: 'Lists records in a scrollable table',
    propsSchema: DataTablePropsSchema,
  },
  {
    type: 'catalog-grid',
    label: 'Product Catalog',
    icon: 'grid-outline',
    description: 'Grid of product or item cards',
    propsSchema: CatalogGridPropsSchema,
  },
  {
    type: 'booking-grid',
    label: 'Booking Slots',
    icon: 'calendar-outline',
    description: 'Appointment time slot picker',
    propsSchema: BookingGridPropsSchema,
  },
  {
    type: 'timeline-feed',
    label: 'Activity Feed',
    icon: 'time-outline',
    description: 'Chronological activity or order feed',
    propsSchema: TimelineFeedPropsSchema,
  },
  {
    type: 'quick-actions',
    label: 'Quick Actions',
    icon: 'flash-outline',
    description: 'Action button grid for common tasks',
    propsSchema: QuickActionsPropsSchema,
  },
  {
    type: 'content-card',
    label: 'Content Card',
    icon: 'document-text-outline',
    description: 'Text content card with optional image',
    propsSchema: ContentCardPropsSchema,
  },

  // Web components
  {
    type: 'hero',
    label: 'Hero Section',
    icon: 'image-outline',
    description: 'Full-width hero banner with headline and CTA',
    propsSchema: HeroPropsSchema,
  },
  {
    type: 'contact-form',
    label: 'Contact Form',
    icon: 'mail-outline',
    description: 'Contact or inquiry form',
    propsSchema: ContactFormPropsSchema,
  },
  {
    type: 'checkout-form',
    label: 'Checkout Form',
    icon: 'card-outline',
    description: 'Checkout or payment form',
    propsSchema: CheckoutFormPropsSchema,
  },
  {
    type: 'menu-grid',
    label: 'Menu Grid',
    icon: 'restaurant-outline',
    description: 'Restaurant menu grid by category',
    propsSchema: MenuGridPropsSchema,
  },
  {
    type: 'service-list',
    label: 'Service List',
    icon: 'briefcase-outline',
    description: 'List of services with pricing',
    propsSchema: ServiceListPropsSchema,
  },
  {
    type: 'announcement-bar',
    label: 'Announcement Bar',
    icon: 'megaphone-outline',
    description: 'Top banner for announcements',
    propsSchema: AnnouncementBarPropsSchema,
  },
  {
    type: 'footer',
    label: 'Footer',
    icon: 'link-outline',
    description: 'Page footer with links and copyright',
    propsSchema: FooterPropsSchema,
  },
  {
    type: 'gallery',
    label: 'Gallery',
    icon: 'images-outline',
    description: 'Image gallery grid',
    propsSchema: GalleryPropsSchema,
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────

export function getCatalogEntry(type: string): ComponentCatalogEntry | undefined {
  return COMPONENT_CATALOG.find((c) => c.type === type);
}

export function getCatalogTypes(): string[] {
  return COMPONENT_CATALOG.map((c) => c.type);
}

export function isValidType(type: string): boolean {
  return COMPONENT_CATALOG.some((c) => c.type === type);
}
