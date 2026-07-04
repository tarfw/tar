/**
 * 14 Capability Modules — form rows in Turso global.
 * Each module = bundle of actions + skills + workflows.
 */

import { executeCreate } from '../lib/helpers';

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  actions: Array<{ name: string; vertical: string; fields: any[]; steps: any[] }>;
}

export const MODULES: ModuleDef[] = [
  {
    id: 'mod_crm',
    name: 'CRM',
    description: 'Leads, follow-ups, deal pipeline, customer tracking',
    capabilities: ['leads', 'deals', 'contacts', 'pipeline'],
    actions: [
      { name: 'Create Lead', vertical: 'crm', fields: [{ name: 'name', type: 'text' }, { name: 'phone', type: 'phone' }], steps: [{ tool: 'create', table: 'matter', type: 'lead' }] },
      { name: 'Convert Lead', vertical: 'crm', fields: [{ name: 'leadId', type: 'text' }, { name: 'value', type: 'number' }], steps: [{ tool: 'create', table: 'matter', type: 'deal' }] },
    ],
  },
  {
    id: 'mod_projects',
    name: 'Projects',
    description: 'Tasks, sprints, milestones, team assignments',
    capabilities: ['tasks', 'sprints', 'milestones', 'assignments'],
    actions: [
      { name: 'Create Task', vertical: 'projects', fields: [{ name: 'title', type: 'text' }, { name: 'assignee', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'task' }] },
      { name: 'Complete Task', vertical: 'projects', fields: [{ name: 'taskId', type: 'text' }], steps: [{ tool: 'update', table: 'matter', patch: { data: { status: 'done' } } }] },
    ],
  },
  {
    id: 'mod_bookings',
    name: 'Bookings',
    description: 'Appointments, slots, scheduling, reminders',
    capabilities: ['appointments', 'slots', 'scheduling'],
    actions: [
      { name: 'Create Booking', vertical: 'bookings', fields: [{ name: 'service', type: 'text' }, { name: 'date', type: 'date' }, { name: 'time', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'booking' }] },
      { name: 'Cancel Booking', vertical: 'bookings', fields: [{ name: 'bookingId', type: 'text' }], steps: [{ tool: 'update', table: 'matter', patch: { data: { status: 'cancelled' } } }] },
    ],
  },
  {
    id: 'mod_inventory',
    name: 'Inventory',
    description: 'Stock tracking, low-stock alerts, restocking, batch/expiry',
    capabilities: ['stock', 'low-stock', 'restocking', 'batch', 'expiry'],
    actions: [
      { name: 'Check Stock', vertical: 'inventory', fields: [], steps: [{ tool: 'read', table: 'matter', type: 'product' }] },
      { name: 'Add Stock', vertical: 'inventory', fields: [{ name: 'productId', type: 'text' }, { name: 'qty', type: 'number' }], steps: [{ tool: 'update', table: 'matter' }] },
    ],
  },
  {
    id: 'mod_orders',
    name: 'Orders',
    description: 'Order creation, status tracking, payment recording',
    capabilities: ['orders', 'payments', 'status'],
    actions: [
      { name: 'Create Order', vertical: 'orders', fields: [{ name: 'items', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'order' }] },
      { name: 'Record Payment', vertical: 'orders', fields: [{ name: 'orderId', type: 'text' }, { name: 'amount', type: 'number' }], steps: [{ tool: 'create', table: 'matter', type: 'payment' }] },
    ],
  },
  {
    id: 'mod_logistics',
    name: 'Logistics',
    description: 'Delivery assignment, driver management, shipment tracking',
    capabilities: ['deliveries', 'drivers', 'tracking'],
    actions: [
      { name: 'Create Delivery', vertical: 'logistics', fields: [{ name: 'orderId', type: 'text' }, { name: 'address', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'delivery' }] },
      { name: 'Assign Driver', vertical: 'logistics', fields: [{ name: 'deliveryId', type: 'text' }, { name: 'driverId', type: 'text' }], steps: [{ tool: 'update', table: 'matter' }] },
    ],
  },
  {
    id: 'mod_hr',
    name: 'HR',
    description: 'Attendance, leave requests, payroll basics',
    capabilities: ['attendance', 'leave', 'payroll'],
    actions: [
      { name: 'Clock In', vertical: 'hr', fields: [{ name: 'employeeId', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'attendance' }] },
      { name: 'Request Leave', vertical: 'hr', fields: [{ name: 'employeeId', type: 'text' }, { name: 'dates', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'leave' }] },
    ],
  },
  {
    id: 'mod_lms',
    name: 'LMS',
    description: 'Course enrollment, assignments, completion tracking',
    capabilities: ['courses', 'enrollments', 'assignments'],
    actions: [
      { name: 'Enroll Student', vertical: 'lms', fields: [{ name: 'courseId', type: 'text' }, { name: 'studentId', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'enrollment' }] },
      { name: 'Submit Assignment', vertical: 'lms', fields: [{ name: 'assignmentId', type: 'text' }], steps: [{ tool: 'update', table: 'matter', patch: { data: { status: 'submitted' } } }] },
    ],
  },
  {
    id: 'mod_listings',
    name: 'Listings',
    description: 'Property/product listings, inquiries, scheduling visits',
    capabilities: ['listings', 'inquiries', 'visits'],
    actions: [
      { name: 'Create Listing', vertical: 'listings', fields: [{ name: 'title', type: 'text' }, { name: 'price', type: 'number' }], steps: [{ tool: 'create', table: 'matter', type: 'listing' }] },
      { name: 'Record Inquiry', vertical: 'listings', fields: [{ name: 'listingId', type: 'text' }, { name: 'buyer', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'inquiry' }] },
    ],
  },
  {
    id: 'mod_support',
    name: 'Support',
    description: 'Ticket queue, chat messages, issue resolution',
    capabilities: ['tickets', 'chat', 'resolution'],
    actions: [
      { name: 'Create Ticket', vertical: 'support', fields: [{ name: 'subject', type: 'text' }, { name: 'description', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'ticket' }] },
      { name: 'Resolve Ticket', vertical: 'support', fields: [{ name: 'ticketId', type: 'text' }], steps: [{ tool: 'update', table: 'matter', patch: { data: { status: 'resolved' } } }] },
    ],
  },
  {
    id: 'mod_team_chat',
    name: 'Team Chat',
    description: 'Internal team messaging, notifications, channel communication',
    capabilities: ['messaging', 'notifications', 'channels'],
    actions: [
      { name: 'Send Message', vertical: 'team_chat', fields: [{ name: 'channel', type: 'text' }, { name: 'content', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'message' }] },
    ],
  },
  {
    id: 'mod_reports',
    name: 'Reports',
    description: 'Sales summary, stock valuation, revenue breakdown, tax reports',
    capabilities: ['sales', 'stock', 'revenue', 'tax'],
    actions: [
      { name: 'Daily Sales Report', vertical: 'reports', fields: [], steps: [{ tool: 'read', table: 'matter', type: 'payment' }] },
      { name: 'Stock Valuation', vertical: 'reports', fields: [], steps: [{ tool: 'read', table: 'matter', type: 'product' }] },
    ],
  },
  {
    id: 'mod_expenses',
    name: 'Expenses',
    description: 'Expense tracking, categories, receipts, vendor payments',
    capabilities: ['tracking', 'categories', 'receipts', 'recurring'],
    actions: [
      { name: 'Record Expense', vertical: 'expenses', fields: [{ name: 'title', type: 'text' }, { name: 'amount', type: 'number' }, { name: 'category', type: 'select' }], steps: [{ tool: 'create', table: 'matter', type: 'expense' }] },
    ],
  },
  {
    id: 'mod_documents',
    name: 'Documents',
    description: 'File attachments, document storage, receipts, invoices',
    capabilities: ['upload', 'storage', 'linking'],
    actions: [
      { name: 'Upload Document', vertical: 'documents', fields: [{ name: 'fileName', type: 'text' }], steps: [{ tool: 'create', table: 'matter', type: 'document' }] },
    ],
  },
];

/**
 * Seed all 14 modules into the form table
 */
export async function seedModules(scope: string = 'global'): Promise<number> {
  let count = 0;
  for (const mod of MODULES) {
    await executeCreate({
      table: 'form',
      type: 'module',
      scope,
      title: mod.name,
      data: {
        name: mod.name,
        description: mod.description,
        capabilities: mod.capabilities,
        actions: mod.actions,
      },
    });
    count++;
  }
  return count;
}

/**
 * Get a module by ID
 */
export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find(m => m.id === id);
}

/**
 * Get modules for a business type
 */
export function getModulesForBusiness(businessType: string): ModuleDef[] {
  const moduleMap: Record<string, string[]> = {
    restaurant: ['mod_orders', 'mod_inventory', 'mod_bookings', 'mod_crm', 'mod_reports', 'mod_expenses', 'mod_documents'],
    salon: ['mod_bookings', 'mod_crm', 'mod_orders', 'mod_reports', 'mod_expenses', 'mod_documents'],
    clinic: ['mod_bookings', 'mod_crm', 'mod_projects', 'mod_support', 'mod_reports', 'mod_expenses', 'mod_documents'],
    retail: ['mod_orders', 'mod_inventory', 'mod_crm', 'mod_reports', 'mod_expenses', 'mod_documents'],
    gym: ['mod_bookings', 'mod_crm', 'mod_lms', 'mod_hr', 'mod_reports', 'mod_expenses', 'mod_documents'],
    agency: ['mod_crm', 'mod_projects', 'mod_hr', 'mod_support', 'mod_reports', 'mod_expenses', 'mod_documents'],
  };

  const ids = moduleMap[businessType] || moduleMap.retail;
  return MODULES.filter(m => ids.includes(m.id));
}
