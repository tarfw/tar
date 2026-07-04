export interface VerticalConfig {
  template: string;
  modules: string[];
  defaultServices?: Array<{ name: string; price: number }>;
}

export const VERTICALS: Record<string, VerticalConfig> = {
  restaurant: {
    template: 'restaurant',
    modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Dine-in', price: 0 },
      { name: 'Takeaway', price: 0 },
      { name: 'Delivery', price: 50 },
    ],
  },
  salon: {
    template: 'salon',
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Haircut', price: 300 },
      { name: 'Shave', price: 100 },
      { name: 'Facial', price: 500 },
    ],
  },
  clinic: {
    template: 'clinic',
    modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Consultation', price: 500 },
      { name: 'Checkup', price: 300 },
    ],
  },
  retail: {
    template: 'retail',
    modules: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
  },
  courier: {
    template: 'courier',
    modules: ['orders', 'logistics', 'crm', 'reports', 'expenses', 'documents'],
  },
  agency: {
    template: 'agency',
    modules: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
  },
  gym: {
    template: 'gym',
    modules: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Monthly Membership', price: 2000 },
      { name: 'Personal Training', price: 500 },
    ],
  },
  school: {
    template: 'school',
    modules: ['lms', 'crm', 'projects', 'hr', 'reports', 'expenses', 'documents'],
  },
  property: {
    template: 'property',
    modules: ['listings', 'crm', 'projects', 'reports', 'expenses', 'documents'],
  },
  'home-services': {
    template: 'home-services',
    modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
    defaultServices: [
      { name: 'Plumbing', price: 500 },
      { name: 'AC Repair', price: 800 },
      { name: 'Cleaning', price: 600 },
    ],
  },
};

export function getVerticalByKeyword(keyword: string): VerticalConfig | null {
  const lower = keyword.toLowerCase();
  for (const [name, config] of Object.entries(VERTICALS)) {
    if (lower.includes(name) || lower.includes(config.template)) {
      return config;
    }
  }
  return null;
}
