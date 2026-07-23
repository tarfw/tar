/**
 * Built-in component registrations.
 * Import this file once to register all native components.
 */

import { registerComponent } from './ComponentRegistry';
import MetricCard from './sections/MetricCard';
import DataTable from './sections/DataTable';
import CatalogGrid from './sections/CatalogGrid';
import BookingGrid from './sections/BookingGrid';
import TimelineFeed from './sections/TimelineFeed';
import QuickActions from './sections/QuickActions';
import ContentCard from './sections/ContentCard';
import EntityNavigator from './sections/EntityNavigator';

// Register all built-in native components
registerComponent('metric-card', {
  component: MetricCard,
  label: 'Metric Card',
  icon: 'trending-up-outline',
  description: 'Displays a single stat or metric with optional trend',
});

registerComponent('data-table', {
  component: DataTable,
  label: 'Data Table',
  icon: 'list-outline',
  description: 'Lists records in a scrollable table',
});

registerComponent('catalog-grid', {
  component: CatalogGrid,
  label: 'Product Catalog',
  icon: 'grid-outline',
  description: 'Grid of product or item cards',
});

registerComponent('booking-grid', {
  component: BookingGrid,
  label: 'Booking Slots',
  icon: 'calendar-outline',
  description: 'Appointment time slot picker',
});

registerComponent('timeline-feed', {
  component: TimelineFeed,
  label: 'Activity Feed',
  icon: 'time-outline',
  description: 'Chronological activity or order feed',
});

registerComponent('quick-actions', {
  component: QuickActions,
  label: 'Quick Actions',
  icon: 'flash-outline',
  description: 'Action button grid for common tasks',
});

registerComponent('content-card', {
  component: ContentCard,
  label: 'Content Card',
  icon: 'document-text-outline',
  description: 'Text content card with optional image',
});

registerComponent('entity-navigator', {
  component: EntityNavigator,
  label: 'Entity Navigator',
  icon: 'navigate-outline',
  description: 'Grid of pressable entity navigation chips',
});

// Register Plan 4 Master Primitive Aliases
registerComponent('data-grid', {
  component: DataTable,
  label: 'Data Grid',
  icon: 'grid-outline',
  description: 'Unified data grid for table, catalog, and booking views',
});

registerComponent('status-board', {
  component: TimelineFeed,
  label: 'Status Board',
  icon: 'shapes-outline',
  description: 'Kanban column board for tracking entity states',
});

registerComponent('pos-sale', {
  component: CatalogGrid,
  label: 'POS Register',
  icon: 'card-outline',
  description: 'Point of sale billing register',
});

