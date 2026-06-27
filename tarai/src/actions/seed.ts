import { getUserDb } from '@/lib/db';
import type { ActionDef } from './definitions';

/**
 * Built-in actions live permanently in userDb.
 * They are inserted once on first launch and never deleted.
 * Users search across built-in + their private DB.
 */

const BUILT_IN_ACTIONS: ActionDef[] = [
  // 1. CRM
  {
    id: 'tool_create_lead',
    name: 'Create Lead',
    description: 'Add a new sales lead to CRM',
    vertical: 'crm',
    icon: 'person-add-outline',
    type: 'tool',
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
    type: 'tool',
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
    id: 'tool_convert_lead',
    name: 'Convert Lead',
    description: 'Convert a sales lead to a customer or opportunity',
    vertical: 'crm',
    icon: 'swap-horizontal-outline',
    type: 'tool',
    keywords: ['close lead', 'lead won', 'convert customer', 'upgrade lead', 'win deal'],
    fields: [
      { name: 'lead_id', type: 'text', label: 'Lead ID', required: true },
      { name: 'deal_value', type: 'number', label: 'Final Deal Value', required: true, placeholder: '10000' },
      { name: 'notes', type: 'textarea', label: 'Closing Notes' },
    ],
    execute: (v) => ({
      formType: 'lead_conversion',
      formScope: 'p',
      title: `Converted Lead: ${v.lead_id}`,
      data: { deal_value: v.deal_value, notes: v.notes },
    }),
  },
  {
    id: 'tool_create_ticket',
    name: 'Create Ticket',
    description: 'Log a support or service ticket',
    vertical: 'crm',
    icon: 'ticket-outline',
    type: 'tool',
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
    id: 'tool_reply_ticket',
    name: 'Reply to Ticket',
    description: 'Log a response to a support ticket',
    vertical: 'crm',
    icon: 'mail-unread-outline',
    type: 'tool',
    keywords: ['answer ticket', 'respond to customer', 'ticket update', 'write back'],
    fields: [
      { name: 'ticket_id', type: 'text', label: 'Ticket ID', required: true },
      { name: 'message', type: 'textarea', label: 'Response Message', required: true },
    ],
    execute: (v) => ({
      formType: 'ticket_reply',
      formScope: 'p',
      title: `Reply to Ticket ${v.ticket_id}`,
      data: { message: v.message },
    }),
  },
  {
    id: 'tool_resolve_ticket',
    name: 'Resolve Ticket',
    description: 'Close support ticket as resolved',
    vertical: 'crm',
    icon: 'lock-closed-outline',
    type: 'tool',
    keywords: ['close ticket', 'ticket resolved', 'fix issue', 'done with ticket'],
    fields: [
      { name: 'ticket_id', type: 'text', label: 'Ticket ID', required: true },
      { name: 'resolution', type: 'textarea', label: 'Resolution details', required: true },
    ],
    execute: (v) => ({
      formType: 'ticket_resolution',
      formScope: 'p',
      title: `Resolved Ticket ${v.ticket_id}`,
      data: { resolution: v.resolution },
    }),
  },

  // 2. E-Commerce & Food & POS
  {
    id: 'tool_decrement_stock',
    name: 'Decrement Stock',
    description: 'Reduce product stock level',
    vertical: 'inventory',
    icon: 'trending-down-outline',
    type: 'tool',
    keywords: ['reduce inventory', 'stock reduction', 'adjust inventory count', 'damaged goods', 'shrinkage'],
    fields: [
      { name: 'product_id', type: 'text', label: 'Product Name/SKU', required: true },
      { name: 'qty', type: 'number', label: 'Quantity to Remove', required: true, placeholder: '1' },
      { name: 'reason', type: 'select', options: ['damaged', 'shrinkage', 'incorrect count', 'other'], label: 'Reason' },
    ],
    execute: (v) => ({
      formType: 'stock_adjustment',
      formScope: 'p',
      title: `Stock Adj: -${v.qty} ${v.product_id}`,
      data: { product_id: v.product_id, qty: v.qty, reason: v.reason },
    }),
  },
  {
    id: 'tool_add_to_cart',
    name: 'Add to Cart',
    description: 'Add an item to checkout shopping cart',
    vertical: 'ecom',
    icon: 'cart-outline',
    type: 'tool',
    keywords: ['add product to cart', 'shopping bag', 'select item', 'purchase step'],
    fields: [
      { name: 'product_id', type: 'text', label: 'Product Name', required: true },
      { name: 'qty', type: 'number', label: 'Quantity', required: true, placeholder: '1' },
      { name: 'price', type: 'number', label: 'Unit Price', placeholder: '1000' },
    ],
    execute: (v) => ({
      formType: 'cart_item',
      formScope: 'p',
      title: `Cart: ${v.qty}x ${v.product_id}`,
      data: { product_id: v.product_id, qty: v.qty, price: v.price },
    }),
  },
  {
    id: 'tool_checkout_food',
    name: 'Food Checkout',
    description: 'Process checkout and place a food order',
    vertical: 'food',
    icon: 'cash-outline',
    type: 'tool',
    keywords: ['place food order', 'buy food', 'restaurant order', 'food payment'],
    fields: [
      { name: 'items', type: 'textarea', label: 'Ordered Items (JSON/List)', required: true },
      { name: 'total', type: 'number', label: 'Total Amount', required: true },
      { name: 'payment_method', type: 'select', options: ['cash', 'card', 'online'], label: 'Payment Method' },
    ],
    execute: (v) => ({
      formType: 'food_order',
      formScope: 'p',
      title: `Food Order: Total ${v.total}`,
      data: { items: v.items, total: v.total, payment_method: v.payment_method },
    }),
  },
  {
    id: 'tool_confirm_food',
    name: 'Confirm Food Order',
    description: 'Acknowledge and confirm food order by merchant',
    vertical: 'food',
    icon: 'checkmark-done-outline',
    type: 'tool',
    keywords: ['accept order', 'merchant confirm', 'kitchen accept'],
    fields: [
      { name: 'order_id', type: 'text', label: 'Order ID', required: true },
      { name: 'prep_notes', type: 'text', label: 'Special Instructions' },
    ],
    execute: (v) => ({
      formType: 'food_order_confirmation',
      formScope: 'p',
      title: `Confirmed Order ${v.order_id}`,
      data: { prep_notes: v.prep_notes },
    }),
  },
  {
    id: 'tool_kitchen_prep',
    name: 'Kitchen Prep',
    description: 'Mark food order as currently in kitchen preparation',
    vertical: 'food',
    icon: 'restaurant-outline',
    type: 'tool',
    keywords: ['cooking order', 'preparing food', 'chef cooking', 'kitchen start'],
    fields: [
      { name: 'order_id', type: 'text', label: 'Order ID', required: true },
      { name: 'estimated_mins', type: 'number', label: 'Estimated Prep Time (mins)', placeholder: '15' },
    ],
    execute: (v) => ({
      formType: 'kitchen_prep',
      formScope: 'p',
      title: `Prep Order ${v.order_id} (${v.estimated_mins}m)`,
      data: { estimated_mins: v.estimated_mins },
    }),
  },
  {
    id: 'tool_ready_food',
    name: 'Mark Food Ready',
    description: 'Mark food order as prepared and ready for pickup/delivery',
    vertical: 'food',
    icon: 'gift-outline',
    type: 'tool',
    keywords: ['order ready', 'prepared', 'ready to pickup', 'food packed'],
    fields: [
      { name: 'order_id', type: 'text', label: 'Order ID', required: true },
    ],
    execute: (v) => ({
      formType: 'order_ready',
      formScope: 'p',
      title: `Order Ready: ${v.order_id}`,
      data: { order_id: v.order_id },
    }),
  },
  {
    id: 'tool_record_sale',
    name: 'Record POS Sale',
    description: 'Log a completed retail sale in the Point of Sale',
    vertical: 'pos',
    icon: 'receipt-outline',
    type: 'tool',
    keywords: ['pos sale', 'checkout register', 'sell item', 'log invoice', 'cashier entry'],
    fields: [
      { name: 'total', type: 'number', label: 'Sale Total', required: true },
      { name: 'payment_mode', type: 'select', options: ['cash', 'card', 'upi'], label: 'Payment Mode', required: true },
      { name: 'items_summary', type: 'text', label: 'Items Sold Summary' },
    ],
    execute: (v) => ({
      formType: 'pos_sale',
      formScope: 'p',
      title: `POS Sale: ${v.total} via ${v.payment_mode}`,
      data: { total: v.total, payment_mode: v.payment_mode, items_summary: v.items_summary },
    }),
  },
  {
    id: 'tool_start_shift',
    name: 'Start Shift',
    description: 'Open cashier drawer and start work shift',
    vertical: 'pos',
    icon: 'time-outline',
    type: 'tool',
    keywords: ['open drawer', 'shift start', 'cashier clock in', 'starting cash'],
    fields: [
      { name: 'starting_cash', type: 'number', label: 'Starting Cash Amount', required: true, placeholder: '5000' },
      { name: 'notes', type: 'text', label: 'Shift Notes' },
    ],
    execute: (v) => ({
      formType: 'pos_shift',
      formScope: 'p',
      title: `Shift Started: Cash ${v.starting_cash}`,
      data: { starting_cash: v.starting_cash, notes: v.notes, status: 'open' },
    }),
  },
  {
    id: 'tool_end_shift',
    name: 'End Shift',
    description: 'Reconcile drawer and close cashier shift',
    vertical: 'pos',
    icon: 'log-out-outline',
    type: 'tool',
    keywords: ['close drawer', 'shift end', 'reconcile cash', 'day close'],
    fields: [
      { name: 'ending_cash', type: 'number', label: 'Actual Ending Cash', required: true },
      { name: 'discrepancy', type: 'number', label: 'Discrepancy (if any)', placeholder: '0' },
    ],
    execute: (v) => ({
      formType: 'pos_shift_close',
      formScope: 'p',
      title: `Shift Closed: Cash ${v.ending_cash}`,
      data: { ending_cash: v.ending_cash, discrepancy: v.discrepancy, status: 'closed' },
    }),
  },
  {
    id: 'tool_token_call',
    name: 'Call Token',
    description: 'Call next queued customer token',
    vertical: 'pos',
    icon: 'megaphone-outline',
    type: 'tool',
    keywords: ['next customer', 'queue call', 'call number', 'token service'],
    fields: [
      { name: 'counter_id', type: 'text', label: 'Counter / Window ID', required: true, placeholder: 'Counter A' },
    ],
    execute: (v) => ({
      formType: 'token_call',
      formScope: 'p',
      title: `Counter ${v.counter_id} calling next token`,
      data: { counter_id: v.counter_id },
    }),
  },
  {
    id: 'tool_token_serve',
    name: 'Serve Token',
    description: 'Mark customer token service as active or complete',
    vertical: 'pos',
    icon: 'people-outline',
    type: 'tool',
    keywords: ['serving customer', 'token active', 'finish customer service'],
    fields: [
      { name: 'token_id', type: 'text', label: 'Token ID / Number', required: true },
    ],
    execute: (v) => ({
      formType: 'token_serve',
      formScope: 'p',
      title: `Serving Token ${v.token_id}`,
      data: { token_id: v.token_id },
    }),
  },
  {
    id: 'tool_fire_kitchen',
    name: 'Fire to Kitchen',
    description: 'Send ticket/order directly to kitchen printers/screens',
    vertical: 'pos',
    icon: 'flame-outline',
    type: 'tool',
    keywords: ['print order', 'send ticket to kitchen', 'fire order'],
    fields: [
      { name: 'order_id', type: 'text', label: 'Order ID', required: true },
    ],
    execute: (v) => ({
      formType: 'kitchen_fired',
      formScope: 'p',
      title: `Fired Order ${v.order_id} to Kitchen`,
      data: { order_id: v.order_id },
    }),
  },

  // 3. Project & Pages
  {
    id: 'tool_create_project',
    name: 'Create Project',
    description: 'Create a new project workspace board',
    vertical: 'project',
    icon: 'folder-open-outline',
    type: 'tool',
    keywords: ['start project', 'new workspace', 'new board', 'project management'],
    fields: [
      { name: 'name', type: 'text', label: 'Project Name', required: true, placeholder: 'Website Redesign' },
      { name: 'deadline', type: 'date', label: 'Project Deadline' },
      { name: 'budget', type: 'number', label: 'Budget Allocation' },
    ],
    execute: (v) => ({
      formType: 'project',
      formScope: 'p',
      title: v.name || 'New Project',
      data: { deadline: v.deadline, budget: v.budget },
    }),
  },
  {
    id: 'tool_create_sprint',
    name: 'Create Sprint',
    description: 'Start a sprint timeline block for team projects',
    vertical: 'project',
    icon: 'repeat-outline',
    type: 'tool',
    keywords: ['new sprint', 'sprint start', 'scrum timeline', 'planning cycle'],
    fields: [
      { name: 'project_id', type: 'text', label: 'Project ID', required: true },
      { name: 'name', type: 'text', label: 'Sprint Name', required: true, placeholder: 'Sprint 24' },
      { name: 'duration_weeks', type: 'number', label: 'Duration (weeks)', placeholder: '2' },
    ],
    execute: (v) => ({
      formType: 'sprint',
      formScope: 'p',
      title: v.name || 'New Sprint',
      data: { project_id: v.project_id, duration_weeks: v.duration_weeks },
    }),
  },
  {
    id: 'tool_assign_issue',
    name: 'Assign Issue',
    description: 'Assign a project issue/bug to team member',
    vertical: 'project',
    icon: 'person-outline',
    type: 'tool',
    keywords: ['assign task', 'assign bug', 'issue owner', 'set assignee'],
    fields: [
      { name: 'issue_id', type: 'text', label: 'Issue ID', required: true },
      { name: 'assignee_id', type: 'text', label: 'Assignee Name/ID', required: true },
    ],
    execute: (v) => ({
      formType: 'issue_assignment',
      formScope: 'p',
      title: `Assign ${v.issue_id} to ${v.assignee_id}`,
      data: { issue_id: v.issue_id, assignee_id: v.assignee_id },
    }),
  },
  {
    id: 'tool_create_page',
    name: 'Create Page',
    description: 'Create a collaborative wiki page or document',
    vertical: 'pages',
    icon: 'document-text-outline',
    type: 'tool',
    keywords: ['new doc', 'write wiki page', 'create document', 'add note', 'knowledge base'],
    fields: [
      { name: 'title', type: 'text', label: 'Page Title', required: true, placeholder: 'Standard Operating Procedures' },
      { name: 'content', type: 'textarea', label: 'Content Markdown', placeholder: '# SOP details...' },
      { name: 'folder_id', type: 'text', label: 'Folder (optional)' },
    ],
    execute: (v) => ({
      formType: 'wiki_page',
      formScope: 'p',
      title: v.title || 'Untitled Page',
      data: { content: v.content, folder_id: v.folder_id },
    }),
  },
  {
    id: 'tool_edit_page',
    name: 'Edit Page',
    description: 'Update content of existing wiki page',
    vertical: 'pages',
    icon: 'create-outline',
    type: 'tool',
    keywords: ['update document', 'edit wiki', 'modify note'],
    fields: [
      { name: 'page_id', type: 'text', label: 'Page ID', required: true },
      { name: 'content', type: 'textarea', label: 'New Content', required: true },
    ],
    execute: (v) => ({
      formType: 'wiki_edit',
      formScope: 'p',
      title: `Edited Page ${v.page_id}`,
      data: { content: v.content },
    }),
  },

  // 4. Logistics
  {
    id: 'tool_create_shipment',
    name: 'Create Shipment',
    description: 'Create shipping dispatch and logistics record',
    vertical: 'logistics',
    icon: 'boat-outline',
    type: 'tool',
    keywords: ['dispatch shipment', 'ship order', 'delivery parcel', 'logistics ship'],
    fields: [
      { name: 'order_id', type: 'text', label: 'Order ID', required: true },
      { name: 'destination', type: 'text', label: 'Destination Address', required: true },
      { name: 'weight', type: 'number', label: 'Weight (kg)', placeholder: '2.5' },
    ],
    execute: (v) => ({
      formType: 'shipment',
      formScope: 'p',
      title: `Shipment: Order ${v.order_id}`,
      data: { destination: v.destination, weight: v.weight, status: 'pending' },
    }),
  },
  {
    id: 'tool_assign_driver',
    name: 'Assign Driver',
    description: 'Assign transport or delivery driver to shipment',
    vertical: 'logistics',
    icon: 'car-outline',
    type: 'tool',
    keywords: ['set delivery driver', 'logistics dispatch', 'driver assign'],
    fields: [
      { name: 'shipment_id', type: 'text', label: 'Shipment ID', required: true },
      { name: 'driver_name', type: 'text', label: 'Driver Name', required: true },
    ],
    execute: (v) => ({
      formType: 'driver_assignment',
      formScope: 'p',
      title: `Driver ${v.driver_name} -> Shipment ${v.shipment_id}`,
      data: { driver_name: v.driver_name },
    }),
  },
  {
    id: 'tool_eta_update',
    name: 'Update ETA',
    description: 'Update shipping estimated arrival time',
    vertical: 'logistics',
    icon: 'timer-outline',
    type: 'tool',
    keywords: ['delivery delay', 'update delivery time', 'estimated time of arrival'],
    fields: [
      { name: 'shipment_id', type: 'text', label: 'Shipment ID', required: true },
      { name: 'new_eta', type: 'date', label: 'New ETA Timestamp', required: true },
    ],
    execute: (v) => ({
      formType: 'eta_update',
      formScope: 'p',
      title: `ETA Shipment ${v.shipment_id}: ${v.new_eta}`,
      data: { new_eta: v.new_eta },
    }),
  },
  {
    id: 'tool_deliver_shipment',
    name: 'Deliver Shipment',
    description: 'Complete parcel delivery tracking',
    vertical: 'logistics',
    icon: 'checkbox-outline',
    type: 'tool',
    keywords: ['package delivered', 'delivered parcel', 'recipient signature'],
    fields: [
      { name: 'shipment_id', type: 'text', label: 'Shipment ID', required: true },
      { name: 'recipient_name', type: 'text', label: 'Received By', required: true, placeholder: 'John Doe' },
    ],
    execute: (v) => ({
      formType: 'delivery_completion',
      formScope: 'p',
      title: `Delivered Shipment ${v.shipment_id} to ${v.recipient_name}`,
      data: { recipient_name: v.recipient_name, status: 'delivered' },
    }),
  },
  {
    id: 'tool_transfer_out',
    name: 'Inventory Transfer Out',
    description: 'Log inventory dispatch outgoing from warehouse',
    vertical: 'inventory',
    icon: 'arrow-forward-outline',
    type: 'tool',
    keywords: ['warehouse dispatch', 'stock transfer out', 'outgoing inventory'],
    fields: [
      { name: 'product_id', type: 'text', label: 'Product Name/SKU', required: true },
      { name: 'qty', type: 'number', label: 'Quantity', required: true },
      { name: 'destination_warehouse', type: 'text', label: 'Destination Warehouse', required: true },
    ],
    execute: (v) => ({
      formType: 'inventory_transfer_out',
      formScope: 'p',
      title: `Transfer Out: ${v.qty}x ${v.product_id} to ${v.destination_warehouse}`,
      data: { product_id: v.product_id, qty: v.qty, destination_warehouse: v.destination_warehouse },
    }),
  },
  {
    id: 'tool_transfer_in',
    name: 'Inventory Transfer In',
    description: 'Log incoming stock transfer arrival at warehouse',
    vertical: 'inventory',
    icon: 'arrow-back-outline',
    type: 'tool',
    keywords: ['warehouse receive', 'stock transfer in', 'incoming inventory'],
    fields: [
      { name: 'product_id', type: 'text', label: 'Product Name/SKU', required: true },
      { name: 'qty', type: 'number', label: 'Quantity Received', required: true },
      { name: 'source_warehouse', type: 'text', label: 'Source Warehouse', required: true },
    ],
    execute: (v) => ({
      formType: 'inventory_transfer_in',
      formScope: 'p',
      title: `Transfer In: ${v.qty}x ${v.product_id} from ${v.source_warehouse}`,
      data: { product_id: v.product_id, qty: v.qty, source_warehouse: v.source_warehouse },
    }),
  },

  // 5. HR & Invoices & Expenses
  {
    id: 'tool_clock_in',
    name: 'Clock In',
    description: 'Record employee shift clock-in time',
    vertical: 'hr',
    icon: 'time-outline',
    type: 'tool',
    keywords: ['start work day', 'clock in', 'attendance start', 'timecard in'],
    fields: [
      { name: 'notes', type: 'text', label: 'Shift/Clock Notes', placeholder: 'Starting remote work' },
    ],
    execute: (v) => ({
      formType: 'clock_record',
      formScope: 'p',
      title: `Clock In: ${new Date().toLocaleTimeString()}`,
      data: { direction: 'in', notes: v.notes },
    }),
  },
  {
    id: 'tool_clock_out',
    name: 'Clock Out',
    description: 'Record employee shift clock-out time',
    vertical: 'hr',
    icon: 'exit-outline',
    type: 'tool',
    keywords: ['end work day', 'clock out', 'attendance end', 'timecard out'],
    fields: [
      { name: 'notes', type: 'text', label: 'Shift/Clock Notes' },
    ],
    execute: (v) => ({
      formType: 'clock_record_out',
      formScope: 'p',
      title: `Clock Out: ${new Date().toLocaleTimeString()}`,
      data: { direction: 'out', notes: v.notes },
    }),
  },
  {
    id: 'tool_request_leave',
    name: 'Request Leave',
    description: 'File a request for paid leave or vacation',
    vertical: 'hr',
    icon: 'calendar-outline',
    type: 'tool',
    keywords: ['request time off', 'sick leave request', 'vacation request', 'apply for leave'],
    fields: [
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true },
      { name: 'reason', type: 'textarea', label: 'Reason for leave', required: true },
    ],
    execute: (v) => ({
      formType: 'leave_request',
      formScope: 'p',
      title: `Leave: ${v.start_date} to ${v.end_date}`,
      data: { start_date: v.start_date, end_date: v.end_date, reason: v.reason, status: 'pending' },
    }),
  },
  {
    id: 'tool_approve_leave',
    name: 'Approve Leave',
    description: 'Approve employee submitted leave request',
    vertical: 'hr',
    icon: 'checkmark-circle-outline',
    type: 'tool',
    keywords: ['approve time off', 'manager approve leave'],
    fields: [
      { name: 'request_id', type: 'text', label: 'Leave Request ID', required: true },
    ],
    execute: (v) => ({
      formType: 'leave_decision',
      formScope: 'p',
      title: `Approved Leave ${v.request_id}`,
      data: { request_id: v.request_id, status: 'approved' },
    }),
  },
  {
    id: 'tool_reject_leave',
    name: 'Reject Leave',
    description: 'Reject employee submitted leave request',
    vertical: 'hr',
    icon: 'close-circle-outline',
    type: 'tool',
    keywords: ['deny time off', 'manager reject leave'],
    fields: [
      { name: 'request_id', type: 'text', label: 'Leave Request ID', required: true },
      { name: 'reason', type: 'textarea', label: 'Reason for rejection', required: true },
    ],
    execute: (v) => ({
      formType: 'leave_decision_reject',
      formScope: 'p',
      title: `Rejected Leave ${v.request_id}`,
      data: { request_id: v.request_id, status: 'rejected', reason: v.reason },
    }),
  },
  {
    id: 'tool_generate_payroll',
    name: 'Generate Payroll',
    description: 'Run determinism scheduler to compute monthly employee payroll',
    vertical: 'hr',
    icon: 'calculator-outline',
    type: 'tool',
    keywords: ['compute salary', 'run payroll', 'generate payslip', 'salary payout'],
    fields: [
      { name: 'month', type: 'select', options: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], label: 'Month', required: true },
      { name: 'year', type: 'number', label: 'Year', required: true, placeholder: '2026' },
    ],
    execute: (v) => ({
      formType: 'payroll_run',
      formScope: 'p',
      title: `Payroll Run: ${v.month} ${v.year}`,
      data: { month: v.month, year: v.year },
    }),
  },
  {
    id: 'tool_create_invoice',
    name: 'Create Invoice',
    description: 'Generate customer invoice billing statement',
    vertical: 'invoices',
    icon: 'receipt-outline',
    type: 'tool',
    keywords: ['bill client', 'generate invoice', 'billing statement', 'charge customer'],
    fields: [
      { name: 'customer_name', type: 'text', label: 'Customer Name', required: true },
      { name: 'amount', type: 'number', label: 'Billing Amount', required: true },
      { name: 'due_date', type: 'date', label: 'Payment Due Date', required: true },
    ],
    execute: (v) => ({
      formType: 'invoice',
      formScope: 'p',
      title: `Invoice to ${v.customer_name}: ${v.amount}`,
      data: { customer_name: v.customer_name, amount: v.amount, due_date: v.due_date, status: 'sent' },
    }),
  },
  {
    id: 'tool_send_invoice',
    name: 'Send Invoice',
    description: 'Email/dispatch created invoice billing link to customer',
    vertical: 'invoices',
    icon: 'send-outline',
    type: 'tool',
    keywords: ['email invoice', 'send bill', 'mail statement'],
    fields: [
      { name: 'invoice_id', type: 'text', label: 'Invoice ID', required: true },
      { name: 'email', type: 'email', label: 'Customer Email', required: true },
    ],
    execute: (v) => ({
      formType: 'invoice_dispatch',
      formScope: 'p',
      title: `Sent Invoice ${v.invoice_id} to ${v.email}`,
      data: { email: v.email },
    }),
  },
  {
    id: 'tool_pay_invoice',
    name: 'Pay Invoice',
    description: 'Record customer payment against invoice',
    vertical: 'invoices',
    icon: 'cash-outline',
    type: 'tool',
    keywords: ['invoice paid', 'collect invoice payment', 'record bill pay'],
    fields: [
      { name: 'invoice_id', type: 'text', label: 'Invoice ID', required: true },
      { name: 'amount_paid', type: 'number', label: 'Amount Paid', required: true },
    ],
    execute: (v) => ({
      formType: 'invoice_payment',
      formScope: 'p',
      title: `Paid Invoice ${v.invoice_id} amount ${v.amount_paid}`,
      data: { amount_paid: v.amount_paid, status: 'paid' },
    }),
  },
  {
    id: 'tool_record_expense',
    name: 'Record Expense',
    description: 'Log a business expense',
    vertical: 'expenses',
    icon: 'wallet-outline',
    type: 'tool',
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
      data: { amount: v.amount, category: v.category, description: v.description, status: 'pending' },
    }),
  },
  {
    id: 'tool_approve_expense',
    name: 'Approve Expense',
    description: 'Approve submitted business expense reimbursement',
    vertical: 'expenses',
    icon: 'checkmark-done-outline',
    type: 'tool',
    keywords: ['reimbursement approve', 'manager approve expense'],
    fields: [
      { name: 'expense_id', type: 'text', label: 'Expense ID', required: true },
    ],
    execute: (v) => ({
      formType: 'expense_decision',
      formScope: 'p',
      title: `Approved Expense ${v.expense_id}`,
      data: { expense_id: v.expense_id, status: 'approved' },
    }),
  },
  {
    id: 'tool_reject_expense',
    name: 'Reject Expense',
    description: 'Reject submitted business expense reimbursement',
    vertical: 'expenses',
    icon: 'close-circle-outline',
    type: 'tool',
    keywords: ['deny expense', 'deny reimbursement'],
    fields: [
      { name: 'expense_id', type: 'text', label: 'Expense ID', required: true },
      { name: 'reason', type: 'textarea', label: 'Rejection Reason', required: true },
    ],
    execute: (v) => ({
      formType: 'expense_decision_reject',
      formScope: 'p',
      title: `Rejected Expense ${v.expense_id}`,
      data: { expense_id: v.expense_id, status: 'rejected', reason: v.reason },
    }),
  },

  // 6. Services & Quotes
  {
    id: 'tool_book_slot',
    name: 'Book Slot',
    description: 'Book a service or appointment slot',
    vertical: 'services',
    icon: 'calendar-number-outline',
    type: 'tool',
    keywords: ['schedule appointment', 'book service', 'reserve slot', 'booking'],
    fields: [
      { name: 'service_id', type: 'text', label: 'Service Name', required: true },
      { name: 'customer_name', type: 'text', label: 'Customer Name', required: true },
      { name: 'time_slot', type: 'text', label: 'Time Slot (e.g. 10:00 AM)', required: true },
    ],
    execute: (v) => ({
      formType: 'appointment_booking',
      formScope: 'p',
      title: `Booking: ${v.service_id} for ${v.customer_name}`,
      data: { service_id: v.service_id, customer_name: v.customer_name, time_slot: v.time_slot, status: 'booked' },
    }),
  },
  {
    id: 'tool_cancel_booking',
    name: 'Cancel Booking',
    description: 'Cancel scheduled service booking',
    vertical: 'services',
    icon: 'calendar-clear-outline',
    type: 'tool',
    keywords: ['cancel appointment', 'cancel reservation', 'booking cancellation'],
    fields: [
      { name: 'booking_id', type: 'text', label: 'Booking ID', required: true },
      { name: 'reason', type: 'textarea', label: 'Reason for cancellation' },
    ],
    execute: (v) => ({
      formType: 'booking_cancellation',
      formScope: 'p',
      title: `Cancelled Booking: ${v.booking_id}`,
      data: { reason: v.reason, status: 'cancelled' },
    }),
  },
  {
    id: 'tool_create_quote',
    name: 'Create Quote',
    description: 'Create a sales quotation or project estimate',
    vertical: 'quotes',
    icon: 'document-outline',
    type: 'tool',
    keywords: ['price quote', 'estimate cost', 'sales quotation', 'bid proposal'],
    fields: [
      { name: 'client_name', type: 'text', label: 'Client Name', required: true },
      { name: 'amount', type: 'number', label: 'Estimated Total', required: true },
      { name: 'description', type: 'textarea', label: 'Quotation details', required: true },
    ],
    execute: (v) => ({
      formType: 'quote',
      formScope: 'p',
      title: `Quote for ${v.client_name}: ${v.amount}`,
      data: { client_name: v.client_name, amount: v.amount, description: v.description, status: 'draft' },
    }),
  },

  // 7. Payments
  {
    id: 'tool_init_payment',
    name: 'Initialize Payment',
    description: 'Create transaction checkout session',
    vertical: 'pay',
    icon: 'card-outline',
    type: 'tool',
    keywords: ['start checkout', 'payment transaction', 'initialize checkout'],
    fields: [
      { name: 'amount', type: 'number', label: 'Amount', required: true },
      { name: 'currency', type: 'select', options: ['USD', 'INR', 'EUR', 'GBP'], label: 'Currency', required: true },
      { name: 'reference', type: 'text', label: 'Reference / Invoice ID' },
    ],
    execute: (v) => ({
      formType: 'payment_transaction',
      formScope: 'p',
      title: `Init Payment: ${v.amount} ${v.currency}`,
      data: { amount: v.amount, currency: v.currency, reference: v.reference, status: 'initialized' },
    }),
  },
  {
    id: 'tool_confirm_payment',
    name: 'Confirm Payment',
    description: 'Record successful payment verification',
    vertical: 'pay',
    icon: 'checkmark-outline',
    type: 'tool',
    keywords: ['payment complete', 'confirm transaction', 'verify payment successful'],
    fields: [
      { name: 'payment_id', type: 'text', label: 'Payment ID', required: true },
    ],
    execute: (v) => ({
      formType: 'payment_confirmation',
      formScope: 'p',
      title: `Confirmed Payment: ${v.payment_id}`,
      data: { payment_id: v.payment_id, status: 'confirmed' },
    }),
  },

  // 8. Marketing
  {
    id: 'tool_create_campaign',
    name: 'Create Campaign',
    description: 'Set up marketing promotional campaign',
    vertical: 'marketing',
    icon: 'megaphone-outline',
    type: 'tool',
    keywords: ['new ad campaign', 'marketing promotion', 'create campaign'],
    fields: [
      { name: 'name', type: 'text', label: 'Campaign Name', required: true, placeholder: 'Summer Sale' },
      { name: 'channel', type: 'select', options: ['email', 'push', 'social', 'sms'], label: 'Channel', required: true },
      { name: 'budget', type: 'number', label: 'Marketing Budget' },
    ],
    execute: (v) => ({
      formType: 'marketing_campaign',
      formScope: 'p',
      title: `Campaign: ${v.name} (${v.channel})`,
      data: { name: v.name, channel: v.channel, budget: v.budget, status: 'active' },
    }),
  },
  {
    id: 'tool_send_push',
    name: 'Send Push Alert',
    description: 'Broadcast push notification to active app users',
    vertical: 'marketing',
    icon: 'notifications-outline',
    type: 'tool',
    keywords: ['send push notification', 'broadcast alert', 'user notification'],
    fields: [
      { name: 'title', type: 'text', label: 'Notification Title', required: true },
      { name: 'body', type: 'textarea', label: 'Alert Body Content', required: true },
    ],
    execute: (v) => ({
      formType: 'push_broadcast',
      formScope: 'p',
      title: `Push: ${v.title}`,
      data: { title: v.title, body: v.body },
    }),
  },

  // 9. General/Task
  {
    id: 'tool_create_task',
    name: 'Create Task',
    description: 'Add a new task or to-do item',
    vertical: 'task',
    icon: 'checkbox-outline',
    type: 'tool',
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
    id: 'tool_add_note',
    name: 'Add Note',
    description: 'Write a quick note or reminder',
    vertical: 'note',
    icon: 'document-text-outline',
    type: 'tool',
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
    type: 'tool',
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
 * Insert built-in actions into userDb on first launch.
 * Uses INSERT OR IGNORE so repeated calls are safe.
 * Actions stay permanently — never deleted.
 */
export async function ensureBuiltins(): Promise<void> {
  try {
    const db = getUserDb();

    // Check if all built-ins are already seeded
    const countRes = (await db.get(
      "SELECT COUNT(*) as count FROM form WHERE type = 'action' AND scope = 'g' AND active = 1"
    ).catch(() => null)) as { count: number } | null | undefined;
    if (countRes && countRes.count === BUILT_IN_ACTIONS.length) return;

    console.log(`[BUILTINS] Inserting ${BUILT_IN_ACTIONS.length} built-in actions into userDb (form table)`);

    const nowStr = new Date().toISOString();

    for (const action of BUILT_IN_ACTIONS) {
      await db.run(
        'INSERT OR REPLACE INTO form (id, code, type, scope, owner, title, public, active, data, time) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [
          action.id,
          action.id,
          'action',
          'g',
          null,
          action.name,
          0,
          JSON.stringify({
            type: action.type,
            description: action.description,
            vertical: action.vertical,
            icon: action.icon,
            keywords: action.keywords || [],
            fields: action.fields,
          }),
          nowStr
        ]
      );
    }

    console.log(`[BUILTINS] Done — ${BUILT_IN_ACTIONS.length} actions in userDb (form table)`);
  } catch (e) {
    console.error('[BUILTINS] Failed:', e);
  }
}

export { BUILT_IN_ACTIONS };

