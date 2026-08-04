/**
 * Core Event System Registry (plan5.md)
 * Hardcoded, built-in definitions for the 14 core event types across 7 categories.
 * Universal default system — requires no S3/OKF skill.md file to execute.
 */

import { ParsedAction, ParsedSkill } from './skill-parser';

export interface EventCategoryDef {
  category: string;
  name: string;
  description: string;
  eventTypes: string[];
}

export const CORE_EVENT_CATEGORIES: EventCategoryDef[] = [
  {
    category: 'Transaction',
    name: 'Transactions & POS',
    description: 'Sales, refunds, and voided orders',
    eventTypes: ['sale', 'refund', 'void'],
  },
  {
    category: 'Logistics',
    name: 'Logistics & Shipping',
    description: 'Shipment creation, tracking updates, and delivery confirmation',
    eventTypes: ['shipment', 'tracking', 'delivered'],
  },
  {
    category: 'Schedule',
    name: 'Appointments & Bookings',
    description: 'Slot booking, schedule status updates, and cancellations',
    eventTypes: ['booking', 'status_change', 'cancel'],
  },
  {
    category: 'Work',
    name: 'Team Work & Tasks',
    description: 'Clock in/out, attendance, and task assignments',
    eventTypes: ['clockin', 'clockout', 'assignment'],
  },
  {
    category: 'Money',
    name: 'Financial Outflow & Costs',
    description: 'Business expenses and financial write-offs',
    eventTypes: ['expense', 'write_off'],
  },
  {
    category: 'Pipeline',
    name: 'CRM & Sales Pipeline',
    description: 'Deals, stage updates, and customer activity logs',
    eventTypes: ['stage', 'activity'],
  },
  {
    category: 'Inventory',
    name: 'Stock & Catalog',
    description: 'Stock count adjustments and damaged inventory write-offs',
    eventTypes: ['adjust', 'write_off'],
  },
];

export const CORE_EVENT_SKILL_MARKDOWN: Record<string, string> = {
  transactions: `---
type: skill
name: transactions
version: 1.0.0
actions:
  - name: action_record_sale
    params: [items, payment_method, total, customer_id]
    icon: receipt
  - name: action_refund_order
    params: [order_id, amount, reason]
    icon: return-left
  - name: action_void_order
    params: [order_id, reason]
    icon: close-circle
app_layout:
  primary_action: action_record_sale
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_sale, action_refund_order, action_void_order]
    - type: metric-card
      title: "Today's Sales"
      variant: "hero-chart"
      theme: "mint"
      data: "SELECT SUM(value) FROM matter WHERE type='order' AND status='active'"
    - type: status-board
      title: "Order Fulfillment"
      props: { type: "order", groupBy: "status" }
    - type: data-grid
      title: "Transactions Feed"
      props: { type: "order", mode: "table" }
---

# Transactions Event Module

### action_record_sale
Record a sale transaction.
steps:
1. create(table='matter', type='order', title='Sale', value={total}, data={payment_method: {payment_method}, line_items: {items}}, status='active')
2. create(table='motion', type='sale', ref={id}, data={total: {total}}, by='agent:taragent')
3. link(src={id}, rel='customer', tgt={customer_id})
4. create(table='inbox', type='order', title='New order', ref={id})

### action_refund_order
Issue a full or partial refund.
steps:
1. update(table='matter', id={order_id}, type='order', status='refunded', data={refund_amount: {amount}, reason: {reason}})
2. create(table='motion', type='refund', ref={order_id}, data={amount: {amount}, reason: {reason}}, by='agent:taragent')

### action_void_order
Void an unpaid transaction.
steps:
1. update(table='matter', id={order_id}, type='order', status='voided', data={reason: {reason}})
2. create(table='motion', type='void', ref={order_id}, data={reason: {reason}}, by='agent:taragent')
`,

  inventory: `---
type: skill
name: inventory
version: 1.0.0
actions:
  - name: action_add_product
    params: [name, price, stock, category]
    icon: add-circle
  - name: action_adjust_stock
    params: [product_id, qty, reason]
    icon: sync
  - name: action_write_off
    params: [product_id, qty, reason]
    icon: trash
app_layout:
  primary_action: action_add_product
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_product, action_adjust_stock, action_write_off]
    - type: metric-card
      title: "Low Stock Items"
      data: "SELECT COUNT(*) FROM matter WHERE type='product' AND value <= 5"
    - type: data-grid
      title: "Product Inventory"
      props: { type: "product", mode: "grid" }
---

# Inventory Event Module

### action_add_product
Add a new product or item to catalog.
steps:
1. create(table='matter', type='product', title={name}, value={stock}, data={price: {price}, category: {category}}, status='active')

### action_adjust_stock
Adjust stock count for product.
steps:
1. read(table='matter', id={product_id}, type='product')
2. update(table='matter', id={product_id}, type='product', data={stock: {qty}, reason: {reason}})
3. create(table='motion', type='adjust', ref={product_id}, data={adjust: {qty}, reason: {reason}}, by='agent:taragent')

### action_write_off
Write off damaged or expired stock.
steps:
1. update(table='matter', id={product_id}, type='product', status='damaged', data={reason: {reason}})
2. create(table='motion', type='write_off', ref={product_id}, data={qty: {qty}, reason: {reason}}, by='agent:taragent')
`,

  schedule: `---
type: skill
name: schedule
version: 1.0.0
actions:
  - name: action_book_slot
    params: [service, date, slot, customer_id, due]
    icon: calendar
  - name: action_update_booking_status
    params: [booking_id, status]
    icon: sync
  - name: action_cancel_booking
    params: [booking_id, reason]
    icon: close-circle
app_layout:
  primary_action: action_book_slot
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_book_slot, action_update_booking_status, action_cancel_booking]
    - type: metric-card
      title: "Today's Bookings"
      data: "SELECT COUNT(*) FROM matter WHERE type='booking' AND status='active'"
    - type: data-grid
      title: "Appointments Calendar"
      props: { type: "booking", mode: "calendar" }
---

# Schedule Event Module

### action_book_slot
Create an appointment booking.
steps:
1. create(table='matter', type='booking', title='Booking', data={service: {service}, date: {date}, slot: {slot}, customer_id: {customer_id}}, status='active')
2. create(table='motion', type='booking', ref={id}, data={service: {service}}, by='agent:taragent')
3. link(src={id}, rel='customer', tgt={customer_id})
4. create(table='inbox', type='booking', title='Booking', ref={id}, due={due})

### action_update_booking_status
Update booking status.
steps:
1. update(table='matter', id={booking_id}, type='booking', status={status})
2. create(table='motion', type='status_change', ref={booking_id}, data={status: {status}}, by='agent:taragent')

### action_cancel_booking
Cancel an appointment booking.
steps:
1. update(table='matter', id={booking_id}, type='booking', status='cancelled', data={reason: {reason}})
2. create(table='motion', type='cancel', ref={booking_id}, data={reason: {reason}}, by='agent:taragent')
`,

  pipeline: `---
type: skill
name: pipeline
version: 1.1.0
actions:
  - name: action_add_contact
    params: [name, phone, email, company_id, role]
    icon: person-add
  - name: action_add_company
    params: [name, industry, website, annual_revenue, employee_count]
    icon: business
  - name: action_link_contact_company
    params: [contact_id, company_id, role]
    icon: link
  - name: action_add_deal
    params: [name, value, stage, expected_close_date, contact_id]
    icon: cash
  - name: action_update_deal_stage
    params: [deal_id, stage, win_loss_reason]
    icon: trending-up
  - name: action_log_activity
    params: [type, description, contact_id, deal_id]
    icon: time
app_layout:
  primary_action: action_add_contact
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_contact, action_add_company, action_add_deal, action_update_deal_stage, action_log_activity]
    - type: metric-card
      title: "Pipeline Value"
      data: "SELECT SUM(value) FROM matter WHERE type='deal' AND status='active'"
    - type: status-board
      title: "Deal Pipeline"
      props: { type: "deal", groupBy: "stage" }
---

# Pipeline Event Module

### action_add_company
Add a new business account / company entity.
steps:
1. create(table='matter', type='company', title={name}, data={industry: {industry}, website: {website}, annual_revenue: {annual_revenue}, employee_count: {employee_count}}, status='active')

### action_link_contact_company
Link an existing customer contact to a company account.
steps:
1. link(src={contact_id}, rel='company', tgt={company_id})
2. update(table='matter', id={contact_id}, type='customer', data={role: {role}})

### action_add_contact
Add a new customer contact.
steps:
1. create(table='matter', type='customer', title={name}, data={phone: {phone}, email: {email}, role: {role}}, status='active')

### action_add_deal
Create a new sales deal in pipeline.
steps:
1. create(table='matter', type='deal', title={name}, value={value}, data={stage: {stage}, expected_close_date: {expected_close_date}}, status='active')
2. link(src={id}, rel='customer', tgt={contact_id})
3. create(table='motion', type='stage', ref={id}, data={stage: {stage}, value: {value}}, by='agent:taragent')

### action_update_deal_stage
Advance pipeline deal stage.
steps:
1. update(table='matter', id={deal_id}, type='deal', data={stage: {stage}, win_loss_reason: {win_loss_reason}})
2. create(table='motion', type='stage', ref={deal_id}, data={stage: {stage}}, by='agent:taragent')

### action_log_activity
Log customer call or meeting activity.
steps:
1. create(table='motion', type='activity', ref={deal_id}, data={activity_type: {type}, description: {description}, contact_id: {contact_id}}, by='agent:taragent')
`,

  logistics: `---
type: skill
name: logistics
version: 1.0.0
actions:
  - name: action_create_shipment
    params: [order_id, address, carrier]
    icon: car
  - name: action_update_tracking
    params: [shipment_id, status, location]
    icon: location
  - name: action_complete_delivery
    params: [shipment_id, recipient_signature]
    icon: checkmark-done
app_layout:
  primary_action: action_create_shipment
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_shipment, action_update_tracking, action_complete_delivery]
    - type: metric-card
      title: "In-Transit Deliveries"
      data: "SELECT COUNT(*) FROM matter WHERE type='shipment' AND status='in_transit'"
    - type: status-board
      title: "Shipment Tracking"
      props: { type: "shipment", groupBy: "status" }
---

# Logistics Event Module

### action_create_shipment
Initiate shipment for order.
steps:
1. create(table='matter', type='shipment', title='Shipment', data={order_id: {order_id}, address: {address}, carrier: {carrier}}, status='in_transit')
2. link(src={id}, rel='order', tgt={order_id})

### action_update_tracking
Update tracking status and current location.
steps:
1. update(table='matter', id={shipment_id}, type='shipment', status={status}, data={location: {location}})
2. create(table='motion', type='tracking', ref={shipment_id}, data={status: {status}, location: {location}}, by='agent:taragent')

### action_complete_delivery
Mark delivery as fulfilled.
steps:
1. update(table='matter', id={shipment_id}, type='shipment', status='delivered', data={signature: {recipient_signature}})
2. create(table='motion', type='delivered', ref={shipment_id}, data={signature: {recipient_signature}}, by='agent:taragent')
`,

  work: `---
type: skill
name: work
version: 1.0.0
actions:
  - name: action_create_task
    params: [title, description, assignee_id, due_date]
    icon: checkbox
  - name: action_clock_in
    params: [staff_id]
    icon: log-in
  - name: action_clock_out
    params: [staff_id]
    icon: log-out
app_layout:
  primary_action: action_create_task
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_task, action_clock_in, action_clock_out]
    - type: metric-card
      title: "Open Work Tasks"
      data: "SELECT COUNT(*) FROM matter WHERE type='project' AND status!='completed'"
    - type: status-board
      title: "Work Progress Board"
      props: { type: "project", groupBy: "status" }
---

# Work Event Module

### action_create_task
Create and assign a work task.
steps:
1. create(table='matter', type='project', title={title}, data={description: {description}, due_date: {due_date}}, status='todo')
2. create(table='inbox', type='project', title={title}, ref={id}, due={due_date})
3. link(src={id}, rel='assigned_to', tgt={assignee_id})

### action_clock_in
Record staff clock-in event.
steps:
1. create(table='motion', type='clockin', ref={staff_id}, by='agent:taragent')

### action_clock_out
Record staff clock-out event.
steps:
1. create(table='motion', type='clockout', ref={staff_id}, by='agent:taragent')
`,

  money: `---
type: skill
name: money
version: 1.0.0
actions:
  - name: action_record_expense
    params: [category, amount, description, date]
    icon: cash
  - name: action_write_off_expense
    params: [expense_id, reason]
    icon: archive
app_layout:
  primary_action: action_record_expense
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_expense, action_write_off_expense]
    - type: metric-card
      title: "Total Expenses"
      data: "SELECT SUM(value) FROM matter WHERE type='expense' AND status='active'"
    - type: data-grid
      title: "Expenses & Outflow Log"
      props: { type: "expense", mode: "table" }
---

# Money Event Module

### action_record_expense
Record a business expense payout.
steps:
1. create(table='matter', type='expense', title={category}, value={amount}, data={description: {description}, date: {date}}, status='active')
2. create(table='motion', type='expense', ref={id}, data={amount: {amount}}, by='agent:taragent')

### action_write_off_expense
Write off an expense record.
steps:
1. update(table='matter', id={expense_id}, type='expense', status='written_off', data={reason: {reason}})
2. create(table='motion', type='write_off', ref={expense_id}, data={reason: {reason}}, by='agent:taragent')
`
};
