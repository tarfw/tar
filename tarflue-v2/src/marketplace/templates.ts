/**
 * Marketplace templates — pre-built workspace configs.
 * Install = copy form rows into workspace scope.
 */

import { executeCreate, executeRead } from '../lib/helpers';

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  modules: string[];
  actions: Array<{
    name: string;
    vertical: string;
    fields: any[];
    steps: any[];
  }>;
  services?: Array<{ name: string; price: number }>;
}

export const MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: 'tpl_restaurant',
    name: 'Restaurant',
    description: 'Orders, inventory, bookings, CRM, reports, expenses',
    modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Record Sale', vertical: 'orders', fields: [{ name: 'items', type: 'text' }, { name: 'paymentMethod', type: 'select' }], steps: [{ tool: 'create', table: 'matter', type: 'order' }] },
      { name: 'Check Stock', vertical: 'inventory', fields: [], steps: [{ tool: 'read', table: 'matter', type: 'product' }] },
    ],
    services: [{ name: 'Dine-in', price: 0 }, { name: 'Takeaway', price: 0 }, { name: 'Delivery', price: 50 }],
  },
  {
    id: 'tpl_salon',
    name: 'Salon',
    description: 'Bookings, CRM, orders, reports, expenses',
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Book Appointment', vertical: 'bookings', fields: [{ name: 'service', type: 'text' }, { name: 'date', type: 'date' }], steps: [{ tool: 'create', table: 'matter', type: 'booking' }] },
    ],
    services: [{ name: 'Haircut', price: 300 }, { name: 'Shave', price: 100 }, { name: 'Facial', price: 500 }],
  },
  {
    id: 'tpl_clinic',
    name: 'Clinic',
    description: 'Bookings, CRM, projects, support, reports, expenses',
    modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Book Appointment', vertical: 'bookings', fields: [{ name: 'patient', type: 'text' }, { name: 'date', type: 'date' }], steps: [{ tool: 'create', table: 'matter', type: 'booking' }] },
    ],
    services: [{ name: 'Consultation', price: 500 }, { name: 'Checkup', price: 300 }],
  },
  {
    id: 'tpl_retail',
    name: 'Retail Store',
    description: 'Orders, inventory, CRM, reports, expenses',
    modules: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Record Sale', vertical: 'orders', fields: [{ name: 'items', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'order' }] },
    ],
  },
  {
    id: 'tpl_gym',
    name: 'Gym',
    description: 'Bookings, CRM, LMS, HR, reports, expenses',
    modules: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Book Class', vertical: 'bookings', fields: [{ name: 'class', type: 'text' }, { name: 'date', type: 'date' }], steps: [{ tool: 'create', table: 'matter', type: 'booking' }] },
    ],
    services: [{ name: 'Monthly Membership', price: 2000 }, { name: 'Personal Training', price: 500 }],
  },
  {
    id: 'tpl_agency',
    name: 'Agency',
    description: 'CRM, projects, HR, support, reports, expenses',
    modules: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
    actions: [
      { name: 'Create Task', vertical: 'projects', fields: [{ name: 'title', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'task' }] },
    ],
  },
];

/**
 * List all available templates
 */
export function listTemplates(): MarketplaceTemplate[] {
  return MARKETPLACE_TEMPLATES;
}

/**
 * Get a template by ID
 */
export function getTemplate(id: string): MarketplaceTemplate | undefined {
  return MARKETPLACE_TEMPLATES.find(t => t.id === id);
}

/**
 * Install a template into a workspace
 */
export async function installTemplate(
  templateId: string,
  scope: string,
  userId: string
): Promise<{ installed: number; services: number }> {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  let installed = 0;

  // Install actions
  for (const action of template.actions) {
    await executeCreate({
      table: 'form',
      type: 'action',
      title: action.name,
      data: {
        name: action.name,
        vertical: action.vertical,
        fields: action.fields,
        steps: action.steps,
      },
      scope,
    });
    installed++;
  }

  // Install services
  let services = 0;
  if (template.services) {
    for (const service of template.services) {
      await executeCreate({
        table: 'matter',
        type: 'service',
        title: service.name,
        value: service.price,
        data: { category: 'service' },
        scope,
      });
      services++;
    }
  }

  return { installed, services };
}

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): MarketplaceTemplate[] {
  const lower = query.toLowerCase();
  return MARKETPLACE_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lower) ||
    t.description.toLowerCase().includes(lower) ||
    t.modules.some(m => m.toLowerCase().includes(lower))
  );
}
