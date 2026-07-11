/**
 * Web built-in component registrations.
 * Import this file once to register all web section renderers.
 */

import { registerSiteComponent } from './SiteRegistry';
import { renderHero } from './sections/Hero';
import { renderCatalogGrid } from './sections/CatalogGrid';
import { renderBookingGrid } from './sections/BookingGrid';
import { renderContactForm } from './sections/ContactForm';
import { renderContentCard } from './sections/ContentCard';
import { renderMetricCard } from './sections/MetricCard';

// Register all built-in web components
registerSiteComponent('hero', {
  renderer: renderHero,
  label: 'Hero Section',
  description: 'Full-width hero banner with headline and CTA',
});

registerSiteComponent('catalog-grid', {
  renderer: renderCatalogGrid,
  label: 'Product Catalog',
  description: 'Grid of product cards',
});

registerSiteComponent('booking-grid', {
  renderer: renderBookingGrid,
  label: 'Booking Slots',
  description: 'Appointment time slot list',
});

registerSiteComponent('contact-form', {
  renderer: renderContactForm,
  label: 'Contact Form',
  description: 'Contact or inquiry form',
});

registerSiteComponent('content-card', {
  renderer: renderContentCard,
  label: 'Content Card',
  description: 'Text content card with optional image',
});

registerSiteComponent('metric-card', {
  renderer: renderMetricCard,
  label: 'Metric Card',
  description: 'Stat or metric display',
});
