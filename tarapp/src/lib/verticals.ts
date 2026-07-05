/**
 * Module manifest registry + vertical definitions.
 * All 14 capability modules with metadata, versions, dependencies.
 */

export interface ModuleManifest {
  name: string;
  displayName: string;
  version: string;
  tools: string[];
  depends: string[];
  description: string;
}

export const MODULES: Record<string, ModuleManifest> = {
  crm: {
    name: 'crm', displayName: 'CRM', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link', 'search'],
    depends: [],
    description: 'Leads, follow-ups, deal pipeline, customer tracking',
  },
  projects: {
    name: 'projects', displayName: 'Projects', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Tasks, sprints, milestones, approvals',
  },
  bookings: {
    name: 'bookings', displayName: 'Bookings', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Appointments, slots, scheduling, reminders',
  },
  inventory: {
    name: 'inventory', displayName: 'Inventory', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Stock, suppliers, batch/expiry, FIFO',
  },
  orders: {
    name: 'orders', displayName: 'Orders', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: ['inventory'],
    description: 'POS, payments, receipts, GST, loyalty',
  },
  logistics: {
    name: 'logistics', displayName: 'Logistics', version: '1.0.0',
    tools: ['create', 'read', 'update', 'link'],
    depends: ['orders'],
    description: 'Delivery, drivers, route optimization',
  },
  hr: {
    name: 'hr', displayName: 'HR', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Attendance, leave, payroll',
  },
  lms: {
    name: 'lms', displayName: 'LMS', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Courses, assignments, completion tracking',
  },
  listings: {
    name: 'listings', displayName: 'Listings', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'Properties, inquiries, scheduling visits',
  },
  support: {
    name: 'support', displayName: 'Support', version: '1.0.0',
    tools: ['create', 'read', 'update', 'link'],
    depends: [],
    description: 'Tickets, chat, issue resolution',
  },
  teamchat: {
    name: 'teamchat', displayName: 'Team Chat', version: '1.0.0',
    tools: ['create', 'read', 'link'],
    depends: [],
    description: 'Internal messaging, notifications',
  },
  reports: {
    name: 'reports', displayName: 'Reports', version: '1.0.0',
    tools: ['read', 'search'],
    depends: [],
    description: 'Sales, stock, tax, revenue summaries',
  },
  expenses: {
    name: 'expenses', displayName: 'Expenses', version: '1.0.0',
    tools: ['create', 'read', 'update', 'link'],
    depends: [],
    description: 'Bills, recurring, categories, receipts',
  },
  documents: {
    name: 'documents', displayName: 'Documents', version: '1.0.0',
    tools: ['create', 'read', 'update', 'delete', 'link'],
    depends: [],
    description: 'File storage, receipts, invoices, linking',
  },
};

// ── Verticals: module bundles per business type ──────────────

export interface VerticalConfig {
  modules: string[];
  defaults?: Record<string, any>;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  restaurant: {
    modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
    defaults: {
      services: [
        { name: 'Dine-in', price: 0 },
        { name: 'Takeaway', price: 0 },
        { name: 'Delivery', price: 50 },
      ],
    },
  },
  salon: {
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    defaults: {
      services: [
        { name: 'Haircut', price: 300 },
        { name: 'Shave', price: 100 },
        { name: 'Facial', price: 500 },
      ],
    },
  },
  clinic: {
    modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
    defaults: {
      services: [
        { name: 'Consultation', price: 500 },
        { name: 'Checkup', price: 300 },
      ],
    },
  },
  retail: {
    modules: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
  },
  courier: {
    modules: ['orders', 'logistics', 'crm', 'reports', 'expenses', 'documents'],
  },
  agency: {
    modules: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
  },
  gym: {
    modules: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
    defaults: {
      services: [
        { name: 'Monthly Membership', price: 2000 },
        { name: 'Personal Training', price: 500 },
      ],
    },
  },
  school: {
    modules: ['lms', 'crm', 'projects', 'hr', 'reports', 'expenses', 'documents'],
  },
  property: {
    modules: ['listings', 'crm', 'projects', 'reports', 'expenses', 'documents'],
  },
  'home-services': {
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    defaults: {
      services: [
        { name: 'Plumbing', price: 500 },
        { name: 'AC Repair', price: 800 },
        { name: 'Cleaning', price: 600 },
      ],
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────

export function getVerticalByKeyword(keyword: string): VerticalConfig | null {
  const lower = keyword.toLowerCase();
  for (const [name, config] of Object.entries(VERTICALS)) {
    if (lower.includes(name)) return config;
  }
  return null;
}

export function getModuleDeps(modules: string[]): string[] {
  const all = new Set<string>();
  for (const mod of modules) {
    const manifest = MODULES[mod];
    if (manifest) {
      for (const dep of manifest.depends) all.add(dep);
    }
  }
  return [...all];
}

export function resolveModules(modules: string[]): string[] {
  const deps = getModuleDeps(modules);
  return [...new Set([...modules, ...deps])];
}
