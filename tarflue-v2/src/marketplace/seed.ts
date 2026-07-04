/**
 * Marketplace seed — actions, workflows, skills, templates in global memory.
 */

import { executeCreate } from '../lib/helpers';

interface MarketplaceItem {
  id: string;
  type: 'action' | 'workflow' | 'skill' | 'template';
  name: string;
  description: string;
  category: string;
  data: any;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // Actions
  {
    id: 'mkt_action_create_lead',
    type: 'action',
    name: 'Create Lead',
    description: 'Create a new sales lead with contact info',
    category: 'crm',
    data: {
      name: 'Create Lead',
      vertical: 'crm',
      fields: [{ name: 'name', type: 'text', required: true }, { name: 'phone', type: 'phone' }, { name: 'source', type: 'text' }],
      steps: [{ tool: 'create', table: 'matter', type: 'lead' }],
    },
  },
  {
    id: 'mkt_action_record_sale',
    type: 'action',
    name: 'Record Sale',
    description: 'Record a POS sale with payment',
    category: 'orders',
    data: {
      name: 'Record Sale',
      vertical: 'orders',
      fields: [{ name: 'items', type: 'text', required: true }, { name: 'paymentMethod', type: 'select' }],
      steps: [{ tool: 'create', table: 'matter', type: 'order' }],
    },
  },
  {
    id: 'mkt_action_create_booking',
    type: 'action',
    name: 'Create Booking',
    description: 'Book an appointment or slot',
    category: 'bookings',
    data: {
      name: 'Create Booking',
      vertical: 'bookings',
      fields: [{ name: 'service', type: 'text', required: true }, { name: 'date', type: 'date', required: true }, { name: 'time', type: 'text', required: true }],
      steps: [{ tool: 'create', table: 'matter', type: 'booking' }],
    },
  },
  {
    id: 'mkt_action_create_task',
    type: 'action',
    name: 'Create Task',
    description: 'Create a task and assign to someone',
    category: 'projects',
    data: {
      name: 'Create Task',
      vertical: 'projects',
      fields: [{ name: 'title', type: 'text', required: true }, { name: 'assignee', type: 'text' }, { name: 'dueDate', type: 'date' }],
      steps: [{ tool: 'create', table: 'matter', type: 'task' }],
    },
  },
  {
    id: 'mkt_action_create_expense',
    type: 'action',
    name: 'Record Expense',
    description: 'Record a business expense',
    category: 'expenses',
    data: {
      name: 'Record Expense',
      vertical: 'expenses',
      fields: [{ name: 'title', type: 'text', required: true }, { name: 'amount', type: 'number', required: true }, { name: 'category', type: 'select' }],
      steps: [{ tool: 'create', table: 'matter', type: 'expense' }],
    },
  },

  // Workflows
  {
    id: 'mkt_workflow_checkout',
    type: 'workflow',
    name: 'Checkout Flow',
    description: 'Complete checkout with stock validation and payment',
    category: 'orders',
    data: {
      name: 'Checkout Flow',
      steps: [
        { action: { tool: 'read', table: 'matter', type: 'product' } },
        { if: '$.stock > 0', then: [
          { parallel: [
            { action: { tool: 'update', table: 'matter' } },
            { action: { tool: 'create', table: 'matter', type: 'payment' } },
          ]},
        ]},
      ],
    },
  },
  {
    id: 'mkt_workflow_record_sale',
    type: 'workflow',
    name: 'Record Sale Workflow',
    description: 'Check stock, deduct, create order, send receipt',
    category: 'orders',
    data: {
      name: 'Record Sale Workflow',
      steps: [
        { action: { tool: 'read', table: 'matter', type: 'product' } },
        { if: '$.stock > 0', then: [
          { parallel: [
            { action: { tool: 'update', table: 'matter' } },
            { action: { tool: 'create', table: 'matter', type: 'order' } },
          ]},
        ]},
      ],
    },
  },

  // Templates
  {
    id: 'mkt_template_restaurant',
    type: 'template',
    name: 'Restaurant Template',
    description: 'Complete restaurant setup with orders, inventory, bookings',
    category: 'restaurant',
    data: {
      name: 'Restaurant',
      modules: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
      services: [{ name: 'Dine-in', price: 0 }, { name: 'Takeaway', price: 0 }, { name: 'Delivery', price: 50 }],
    },
  },
  {
    id: 'mkt_template_salon',
    type: 'template',
    name: 'Salon Template',
    description: 'Salon setup with bookings, CRM, orders',
    category: 'salon',
    data: {
      name: 'Salon',
      modules: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
      services: [{ name: 'Haircut', price: 300 }, { name: 'Shave', price: 100 }, { name: 'Facial', price: 500 }],
    },
  },
  {
    id: 'mkt_template_clinic',
    type: 'template',
    name: 'Clinic Template',
    description: 'Clinic setup with bookings, CRM, projects',
    category: 'clinic',
    data: {
      name: 'Clinic',
      modules: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
      services: [{ name: 'Consultation', price: 500 }, { name: 'Checkup', price: 300 }],
    },
  },
];

/**
 * Seed marketplace items into global memory table
 */
export async function seedMarketplace(): Promise<number> {
  let count = 0;
  for (const item of MARKETPLACE_ITEMS) {
    await executeCreate({
      table: 'memory',
      text: `${item.name}: ${item.description}`,
      meta: {
        type: 'marketplace',
        itemType: item.type,
        category: item.category,
        itemId: item.id,
        data: item.data,
      },
    });
    count++;
  }
  return count;
}

/**
 * Search marketplace items
 */
export async function searchMarketplace(
  query: string,
  type?: string
): Promise<any[]> {
  const { executeSearch } = await import('../lib/helpers');
  const result = await executeSearch({
    query,
    limit: 20,
  });

  return (result.rows || [])
    .filter((r: any) => {
      const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
      if (type && meta?.itemType !== type) return false;
      return meta?.type === 'marketplace';
    })
    .map((r: any) => {
      const meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
      return {
        id: meta?.itemId,
        type: meta?.itemType,
        name: r.text?.split(':')[0]?.trim(),
        description: r.text?.split(':').slice(1).join(':').trim(),
        category: meta?.category,
        data: meta?.data,
      };
    });
}
