/**
 * Seed actions — JSON action definitions stored as form rows.
 * These are the built-in actions that ship with the platform.
 */

import { executeCreate } from '../lib/helpers';
import type { ActionDefinition } from './types';

export const SEED_ACTIONS: ActionDefinition[] = [
  {
    id: 'action_create_lead',
    name: 'Create Lead',
    description: 'Create a new sales lead',
    vertical: 'crm',
    fields: [
      { name: 'name', type: 'text', label: 'Lead Name', required: true },
      { name: 'phone', type: 'phone', label: 'Phone' },
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'source', type: 'text', label: 'Source' },
      { name: 'value', type: 'number', label: 'Estimated Value' },
    ],
    steps: [
      { tool: 'create', table: 'matter', type: 'lead', title: '$.name', value: '$.value', data: { phone: '$.phone', email: '$.email', source: '$.source' }, scope: '$.scope' },
      { tool: 'link', src: '$.userId', rel: 'owns', tgt: '$.result.step_0.id', active: true },
      { tool: 'create', table: 'motion', stream: '$.result.step_0.id', action: 99993, data: { event: 'lead_created', name: '$.name' }, scope: '$.scope' },
    ],
    outputTemplate: 'Lead created: $.name',
  },
  {
    id: 'action_record_sale',
    name: 'Record Sale',
    description: 'Record a POS sale with payment',
    vertical: 'pos',
    fields: [
      { name: 'items', type: 'text', label: 'Items (JSON array)', required: true },
      { name: 'paymentMethod', type: 'select', label: 'Payment Method', options: ['cash', 'upi', 'card'] },
    ],
    steps: [
      { tool: 'create', table: 'matter', type: 'payment', title: 'Sale', value: '$.total', data: { items: '$.items', paymentMethod: '$.paymentMethod', status: 'completed' }, scope: '$.scope' },
      { tool: 'create', table: 'motion', stream: '$.result.step_0.id', action: 99993, data: { event: 'sale_recorded', paymentMethod: '$.paymentMethod' }, scope: '$.scope' },
    ],
    outputTemplate: 'Sale recorded. Total: ₹$.total',
  },
  {
    id: 'action_check_stock',
    name: 'Check Stock',
    description: 'Check current stock levels',
    vertical: 'inventory',
    fields: [
      { name: 'scope', type: 'text', label: 'Workspace', required: true },
    ],
    steps: [
      { tool: 'read', table: 'matter', type: 'product', active: true, scope: '$.scope', limit: 50 },
    ],
    outputTemplate: 'Found $.result.step_0.count products',
  },
  {
    id: 'action_add_stock',
    name: 'Add Stock',
    description: 'Add stock to a product',
    vertical: 'inventory',
    fields: [
      { name: 'productId', type: 'text', label: 'Product ID', required: true },
      { name: 'qty', type: 'number', label: 'Quantity to Add', required: true },
    ],
    steps: [
      { tool: 'read', table: 'matter', id: '$.productId', scope: '$.scope' },
      { tool: 'update', table: 'matter', id: '$.productId', patch: { qty: '$.result.step_0.rows.0.qty + $.qty' }, scope: '$.scope' },
      { tool: 'create', table: 'motion', stream: '$.productId', action: 99993, data: { event: 'stock_added', qty: '$.qty' }, scope: '$.scope' },
    ],
    outputTemplate: 'Stock updated for $.productId',
  },
  {
    id: 'action_create_task',
    name: 'Create Task',
    description: 'Create a task and assign to someone',
    vertical: 'projects',
    fields: [
      { name: 'title', type: 'text', label: 'Task Title', required: true },
      { name: 'assignee', type: 'text', label: 'Assignee' },
      { name: 'dueDate', type: 'date', label: 'Due Date' },
    ],
    steps: [
      { tool: 'create', table: 'matter', type: 'task', title: '$.title', data: { assignee: '$.assignee', dueDate: '$.dueDate', status: 'todo' }, scope: '$.scope' },
      { tool: 'link', src: '$.userId', rel: 'assigned', tgt: '$.result.step_0.id', active: true },
      { tool: 'create', table: 'motion', stream: '$.result.step_0.id', action: 99993, data: { event: 'task_created', title: '$.title' }, scope: '$.scope' },
    ],
    outputTemplate: 'Task created: $.title',
  },
  {
    id: 'action_create_booking',
    name: 'Create Booking',
    description: 'Book an appointment or slot',
    vertical: 'booking',
    fields: [
      { name: 'service', type: 'text', label: 'Service', required: true },
      { name: 'date', type: 'date', label: 'Date', required: true },
      { name: 'time', type: 'text', label: 'Time', required: true },
      { name: 'customer', type: 'text', label: 'Customer Name' },
    ],
    steps: [
      { tool: 'create', table: 'matter', type: 'booking', title: '$.service', data: { date: '$.date', time: '$.time', customer: '$.customer', status: 'confirmed' }, scope: '$.scope' },
      { tool: 'create', table: 'motion', stream: '$.result.step_0.id', action: 99993, data: { event: 'booking_created', service: '$.service', date: '$.date', time: '$.time' }, scope: '$.scope' },
    ],
    outputTemplate: 'Booked: $.service on $.date at $.time',
  },
  {
    id: 'action_create_expense',
    name: 'Record Expense',
    description: 'Record a business expense',
    vertical: 'expenses',
    fields: [
      { name: 'title', type: 'text', label: 'Description', required: true },
      { name: 'amount', type: 'number', label: 'Amount', required: true },
      { name: 'category', type: 'select', label: 'Category', options: ['rent', 'salary', 'utilities', 'supplies', 'marketing', 'maintenance', 'transport', 'misc'] },
      { name: 'paymentMethod', type: 'select', label: 'Payment Method', options: ['cash', 'upi', 'bank'] },
    ],
    steps: [
      { tool: 'create', table: 'matter', type: 'expense', title: '$.title', value: '$.amount', data: { category: '$.category', paymentMethod: '$.paymentMethod', status: 'paid' }, scope: '$.scope' },
      { tool: 'link', src: '$.scope', rel: 'has_expense', tgt: '$.result.step_0.id', active: true },
      { tool: 'create', table: 'motion', stream: '$.result.step_0.id', action: 99993, data: { event: 'expense_recorded', title: '$.title', amount: '$.amount' }, scope: '$.scope' },
    ],
    outputTemplate: 'Expense recorded: $.title ₹$.amount',
  },
  {
    id: 'action_report_daily_sales',
    name: 'Daily Sales Report',
    description: 'Show today\'s sales summary',
    vertical: 'reports',
    fields: [
      { name: 'scope', type: 'text', label: 'Workspace', required: true },
    ],
    steps: [
      { tool: 'read', table: 'matter', type: 'payment', scope: '$.scope', limit: 100 },
    ],
    outputTemplate: 'Sales report generated',
  },
  {
    id: 'action_report_low_stock',
    name: 'Low Stock Alert',
    description: 'Show products running low',
    vertical: 'reports',
    fields: [
      { name: 'scope', type: 'text', label: 'Workspace', required: true },
    ],
    steps: [
      { tool: 'read', table: 'matter', type: 'product', active: true, scope: '$.scope', filters: [{ key: 'min_stock', val: null }], limit: 50 },
    ],
    outputTemplate: 'Low stock report generated',
  },
];

/**
 * Seed all built-in actions into the form table
 */
export async function seedActions(scope: string): Promise<number> {
  let count = 0;
  for (const action of SEED_ACTIONS) {
    await executeCreate({
      table: 'form',
      type: 'action',
      scope,
      title: action.name,
      data: {
        name: action.name,
        description: action.description,
        vertical: action.vertical,
        fields: action.fields,
        steps: action.steps,
        outputTemplate: action.outputTemplate,
      },
    });
    count++;
  }
  return count;
}
