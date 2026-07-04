/**
 * Workspace Creation Flow — creates a new workspace from a template.
 * Agent detects intent → picks template → copies modules → generates site → goes live.
 */

import { executeCreate, executeRead } from '../lib/helpers';
import { dbRun } from '../lib/db';
import { SEED_ACTIONS } from '../actions/seed';

export interface WorkspaceTemplate {
  name: string;
  modules: string[];
  defaultServices?: Array<{ name: string; price: number }>;
}

export const WORKSPACE_TEMPLATES: Record<string, WorkspaceTemplate> = {
  restaurant: {
    name: 'Restaurant',
    modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Dine-in', price: 0 },
      { name: 'Takeaway', price: 0 },
      { name: 'Delivery', price: 50 },
    ],
  },
  salon: {
    name: 'Salon',
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Haircut', price: 300 },
      { name: 'Shave', price: 100 },
      { name: 'Facial', price: 500 },
    ],
  },
  clinic: {
    name: 'Clinic',
    modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Consultation', price: 500 },
      { name: 'Checkup', price: 300 },
    ],
  },
  retail: {
    name: 'Retail Store',
    modules: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
  },
  gym: {
    name: 'Gym',
    modules: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Monthly Membership', price: 2000 },
      { name: 'Personal Training', price: 500 },
    ],
  },
  agency: {
    name: 'Agency',
    modules: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
  },
};

/**
 * Create a new workspace from a template.
 */
export async function createWorkspace(input: {
  userId: string;
  name: string;
  template: string;
  subdomain: string;
  city?: string;
  services?: Array<{ name: string; price: number }>;
}): Promise<{ scope: string; url: string }> {
  const scopeId = `w:${input.subdomain.replace(/[^a-z0-9-]/g, '-').toLowerCase()}`;
  const template = WORKSPACE_TEMPLATES[input.template];
  if (!template) throw new Error(`Unknown template: ${input.template}`);

  // 1. Create workspace matter in WorkspaceDO
  const workspace = await executeCreate({
    table: 'matter',
    type: 'workspace',
    title: input.name,
    data: {
      template: input.template,
      city: input.city,
      modules: template.modules,
      subdomain: input.subdomain,
    },
    scope: scopeId,
  });

  // 2. Link user as owner
  await executeCreate({
    table: 'graph',
    src: input.userId,
    rel: 'owner',
    tgt: scopeId,
  });

  // 3. Copy template actions to workspace scope
  const templateActions = SEED_ACTIONS.filter(a =>
    template.modules.includes(a.vertical)
  );
  for (const action of templateActions) {
    await executeCreate({
      table: 'form',
      type: 'action',
      title: action.name,
      data: {
        name: action.name,
        description: action.description,
        vertical: action.vertical,
        fields: action.fields,
        steps: action.steps,
        outputTemplate: action.outputTemplate,
      },
      scope: scopeId,
    });
  }

  // 4. Create service matter rows
  const services = input.services || template.defaultServices || [];
  for (const service of services) {
    await executeCreate({
      table: 'matter',
      type: 'service',
      title: service.name,
      value: service.price,
      data: { category: 'service' },
      scope: scopeId,
    });
  }

  // 5. Register subdomain
  await dbRun(
    `INSERT OR REPLACE INTO form (id, type, scope, title, data, time, active) VALUES (?, 'subdomain', 'global', ?, ?, ?, 1)`,
    [`subdomain_${input.subdomain}`, input.subdomain, JSON.stringify({ scope: scopeId, name: input.name }), new Date().toISOString()]
  );

  const url = `https://${input.subdomain}.tarai.space`;

  return { scope: scopeId, url };
}

/**
 * Match a business description to a template.
 */
export function matchTemplate(description: string): string | null {
  const lower = description.toLowerCase();

  if (lower.includes('restaurant') || lower.includes('cafe') || lower.includes('food')) {
    return 'restaurant';
  }
  if (lower.includes('salon') || lower.includes('spa') || lower.includes('grooming')) {
    return 'salon';
  }
  if (lower.includes('clinic') || lower.includes('doctor') || lower.includes('hospital')) {
    return 'clinic';
  }
  if (lower.includes('store') || lower.includes('shop') || lower.includes('retail')) {
    return 'retail';
  }
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('yoga')) {
    return 'gym';
  }
  if (lower.includes('agency') || lower.includes('office') || lower.includes('company')) {
    return 'agency';
  }

  return null;
}
