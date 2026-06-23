import { getGlobalDb } from '@/lib/db';
import type { SkillDef } from './definitions';

/**
 * Built-in skills live permanently in global.db.
 * They are inserted once on first launch and never deleted.
 * Users search across global.db + their private DB.
 */

const BUILT_IN_SKILLS: SkillDef[] = [
  {
    id: 'tool_create_lead',
    name: 'Create Lead',
    description: 'Add a new sales lead to CRM',
    vertical: 'crm',
    icon: 'person-add-outline',
    keywords: ['new customer interested in buying', 'prospect', 'potential client', 'someone wants to buy', 'add a contact', 'enquiry', 'walk-in customer', 'capture a lead'],
    fields: [
      { name: 'name', type: 'text', label: 'Contact Name', required: true, placeholder: 'Priya Sharma' },
      { name: 'phone', type: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
      { name: 'email', type: 'email', label: 'Email', placeholder: 'email@example.com' },
      { name: 'source', type: 'select', label: 'Source', options: ['walk-in', 'online', 'referral', 'cold-call', 'social'] },
      { name: 'interest', type: 'text', label: 'Product Interest', placeholder: 'Sneakers, Formal shoes...' },
      { name: 'value', type: 'number', label: 'Estimated Value', placeholder: '5000' },
    ],
    execute: (v) => ({
      formType: 'lead',
      formScope: 'p',
      title: v.name || 'New Lead',
      data: { phone: v.phone, email: v.email, source: v.source, interest: v.interest, value: v.value },
    }),
  },
  {
    id: 'tool_log_visit',
    name: 'Log Store Visit',
    description: 'Record a customer visit to the store',
    vertical: 'crm',
    icon: 'walk-outline',
    keywords: ['customer came to the shop', 'someone visited the store', 'record a walk-in', 'log a visit', 'foot traffic', 'in-person visit'],
    fields: [
      { name: 'person', type: 'text', label: 'Customer Name', required: true, placeholder: 'Who visited?' },
      { name: 'notes', type: 'textarea', label: 'Visit Notes', placeholder: 'What happened during the visit?' },
      { name: 'rating', type: 'rating', label: 'Satisfaction' },
    ],
    execute: (v) => ({
      formType: 'visit',
      formScope: 'p',
      title: `Visit: ${v.person || 'Unknown'}`,
      data: { notes: v.notes, rating: v.rating },
    }),
  },
  {
    id: 'tool_create_ticket',
    name: 'Create Ticket',
    description: 'Log a support or service ticket',
    vertical: 'crm',
    icon: 'ticket-outline',
    keywords: ['angry customer has a problem', 'complaint', 'something is broken', 'customer issue', 'report a bug', 'service request', 'raise a support ticket', 'help needed'],
    fields: [
      { name: 'subject', type: 'text', label: 'Subject', required: true, placeholder: 'Issue description' },
      { name: 'customer', type: 'text', label: 'Customer', required: true, placeholder: 'Customer name' },
      { name: 'priority', type: 'select', label: 'Priority', options: ['Low', 'Medium', 'High', 'Urgent'] },
      { name: 'description', type: 'textarea', label: 'Details', placeholder: 'What is the issue?' },
    ],
    execute: (v) => ({
      formType: 'ticket',
      formScope: 'p',
      title: v.subject || 'New Ticket',
      data: { customer: v.customer, priority: v.priority, description: v.description },
    }),
  },
  {
    id: 'tool_create_task',
    name: 'Create Task',
    description: 'Add a new task or to-do item',
    vertical: 'task',
    icon: 'checkbox-outline',
    keywords: ['i need to follow up tomorrow', 'remind me to do something', 'add a to-do', 'things to do', 'assign work', 'set a reminder', 'action item', 'i have to'],
    fields: [
      { name: 'title', type: 'text', label: 'Task Title', required: true, placeholder: 'What needs to be done?' },
      { name: 'assignee', type: 'text', label: 'Assignee', placeholder: 'Who is responsible?' },
      { name: 'due', type: 'date', label: 'Due Date' },
      { name: 'priority', type: 'select', label: 'Priority', options: ['low', 'medium', 'high'] },
    ],
    execute: (v) => ({
      formType: 'task',
      formScope: 'p',
      title: v.title || 'New Task',
      data: { assignee: v.assignee, due: v.due, priority: v.priority },
    }),
  },
  {
    id: 'tool_record_payment',
    name: 'Record Payment',
    description: 'Log an incoming payment',
    vertical: 'pay',
    icon: 'cash-outline',
    keywords: ['customer just paid me', 'received money', 'got paid', 'log a payment', 'money came in', 'collected cash', 'payment received'],
    fields: [
      { name: 'amount', type: 'number', label: 'Amount', required: true, placeholder: '5000' },
      { name: 'from', type: 'text', label: 'From', required: true, placeholder: 'Customer or vendor name' },
      { name: 'method', type: 'select', label: 'Method', options: ['cash', 'upi', 'card', 'bank-transfer'] },
      { name: 'description', type: 'text', label: 'Description', placeholder: 'For what?' },
    ],
    execute: (v) => ({
      formType: 'payment',
      formScope: 'p',
      title: `${v.amount || 0} from ${v.from || 'Unknown'}`,
      data: { amount: v.amount, from: v.from, method: v.method, description: v.description },
    }),
  },
  {
    id: 'tool_record_expense',
    name: 'Record Expense',
    description: 'Log a business expense',
    vertical: 'pay',
    icon: 'wallet-outline',
    keywords: ['i spent money', 'bought supplies', 'paid for something', 'business cost', 'record what i spent', 'money went out', 'purchase'],
    fields: [
      { name: 'amount', type: 'number', label: 'Amount', required: true, placeholder: '500' },
      { name: 'category', type: 'select', label: 'Category', required: true, options: ['supplies', 'travel', 'food', 'utilities', 'rent', 'other'] },
      { name: 'description', type: 'text', label: 'Description', required: true, placeholder: 'What was it for?' },
    ],
    execute: (v) => ({
      formType: 'expense',
      formScope: 'p',
      title: `${v.category || 'Expense'}: ${v.amount || 0}`,
      data: { amount: v.amount, category: v.category, description: v.description },
    }),
  },
  {
    id: 'tool_add_note',
    name: 'Add Note',
    description: 'Write a quick note or reminder',
    vertical: 'note',
    icon: 'document-text-outline',
    keywords: ['jot something down', 'write a note', 'save a thought', 'memo', 'quick reminder', 'note to self'],
    fields: [
      { name: 'title', type: 'text', label: 'Title', required: true, placeholder: 'Note title' },
      { name: 'body', type: 'textarea', label: 'Content', placeholder: 'Write something...' },
    ],
    execute: (v) => ({
      formType: 'note',
      formScope: 'p',
      title: v.title || 'Untitled Note',
      data: { body: v.body },
    }),
  },
  {
    id: 'tool_create_team',
    name: 'Create Team',
    description: 'Set up a new workspace or team',
    vertical: 'team',
    icon: 'people-outline',
    keywords: ['start a new group', 'set up a workspace', 'create a department', 'add a team', 'organize people'],
    fields: [
      { name: 'name', type: 'text', label: 'Team Name', required: true, placeholder: 'Marketing Team' },
      { name: 'description', type: 'textarea', label: 'Purpose', placeholder: 'What is this team for?' },
    ],
    execute: (v) => ({
      formType: 'team',
      formScope: 'p',
      title: v.name || 'New Team',
      data: { description: v.description },
    }),
  },
];

/**
 * Insert built-in skills into global.db on first launch.
 * Uses INSERT OR IGNORE so repeated calls are safe.
 * Skills stay permanently — never deleted.
 */
export async function ensureBuiltins(): Promise<void> {
  try {
    const db = getGlobalDb();

    // Check if already seeded
    const existing = await db.get(
      "SELECT id FROM form WHERE id = 'tool_create_lead'"
    ).catch(() => null);
    if (existing) return;

    console.log(`[BUILTINS] Inserting ${BUILT_IN_SKILLS.length} built-in skills into global.db`);

    for (const skill of BUILT_IN_SKILLS) {
      const data = JSON.stringify({
        description: skill.description,
        vertical: skill.vertical,
        fields: skill.fields,
        keywords: skill.keywords,
        execute: skill.execute,
        custom: false,
        builtIn: true,
      });

      await db.run(
        'INSERT OR IGNORE INTO form (id, type, title, scope, public, data, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [skill.id, 'tool', skill.name, 'g', 1, data]
      );
    }

    console.log(`[BUILTINS] Done — ${BUILT_IN_SKILLS.length} skills in global.db`);
  } catch (e) {
    console.error('[BUILTINS] Failed:', e);
  }
}

export { BUILT_IN_SKILLS };
