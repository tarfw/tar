export const CORE_MODULES: Record<string, string> = {
  orders: `---
type: skill
name: orders
version: 1.0.0
actions:
  - name: action_record_sale
    params: [items, payment_method, total, customer_id]
    icon: receipt
  - name: action_void_order
    params: [order_id, reason]
    icon: close-circle
app_layout:
  primary_action: action_record_sale
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_sale, action_void_order]
    - type: metric-card
      title: "Today's Sales"
      data: "SELECT COUNT(*) FROM motion WHERE type='sale'"
site_pages:
  - slug: /menu
    template: catalog-grid
    data_source: "matter WHERE type = 'product'"
  - slug: /cart
    template: cart
    data_source: ""
  - slug: /checkout
    template: checkout
    data_source: ""
---

# Orders Module

Handles POS orders and sales recording.

### action_record_sale
Record a customer purchase.
steps:
1. create(table='matter', type='order', title='Sale', value={total}, data={payment_method: {payment_method}, line_items: {items}}, status='active')
2. create(table='motion', type='sale', ref={id}, data={total: {total}}, by='agent:taragent')
3. link(src={id}, rel='customer', tgt={customer_id})
4. create(table='inbox', type='order', title='New order', ref={id})
5. for each item: read(table='matter', id={productId}, type='product') -> update(table='matter', id={productId}, type='product', value=currentValue-{qty})

### action_void_order
Void a transaction.
steps:
1. update(table='matter', id={order_id}, type='order', status='voided', data={reason: {reason}})
`,

  inventory: `---
type: skill
name: inventory
version: 1.0.0
actions:
  - name: action_check_stock
    params: []
    icon: list
  - name: action_add_stock
    params: [product_id, qty]
    icon: add-circle
app_layout:
  primary_action: action_check_stock
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_check_stock, action_add_stock]
    - type: metric-card
      title: "Low Stock Alert"
      data: "SELECT COUNT(*) FROM matter WHERE type='product' AND value <= 5"
site_pages:
  - slug: /catalog
    template: catalog-grid
    data_source: "matter WHERE type = 'product'"
---

# Inventory Module

Tracks and adjusts stock levels.

### action_check_stock
Check inventory levels.
steps:
1. read(table='matter', type='product', status='active')

### action_add_stock
Adjust stock quantity.
steps:
1. read(table='matter', id={product_id}, type='product')
2. update(table='matter', id={product_id}, type='product', value=currentValue+{qty})
3. create(table='motion', type='adjust', ref={product_id}, data={adjust: {qty}}, by='agent:taragent')
`,

  bookings: `---
type: skill
name: bookings
version: 1.0.0
actions:
  - name: action_book_slot
    params: [service, date, slot, customer_id, due]
    icon: calendar
  - name: action_cancel_booking
    params: [booking_id]
    icon: calendar-outline
app_layout:
  primary_action: action_book_slot
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_book_slot, action_cancel_booking]
site_pages:
  - slug: /book
    template: booking-widget
    data_source: "matter WHERE type = 'service'"
---

# Bookings Module

Manages appointments and schedules.

### action_book_slot
Create an appointment booking.
steps:
1. create(table='matter', type='booking', title='Booking', data={service: {service}, date: {date}, slot: {slot}, customer_id: {customer_id}}, status='active')
2. create(table='motion', type='booking', ref={id}, data={service: {service}}, by='agent:taragent')
3. create(table='inbox', type='booking', title='Booking', ref={id}, due={due})

### action_cancel_booking
Cancel an appointment.
steps:
1. update(table='matter', id={booking_id}, type='booking', status='cancelled')
`,

  crm: `---
type: skill
name: crm
version: 1.0.0
actions:
  - name: action_add_contact
    params: [name, phone, email, company_id, role, source]
    icon: person-add
  - name: action_get_contact
    params: [contact_id]
    icon: person
  - name: action_add_company
    params: [name, industry, size, website, address]
    icon: business
  - name: action_get_company
    params: [company_id]
    icon: business-outline
  - name: action_add_deal
    params: [name, value, stage, expected_close_date, contact_id, company_id]
    icon: cash
  - name: action_update_deal_stage
    params: [deal_id, stage, win_loss_reason]
    icon: trending-up
  - name: action_log_activity
    params: [type, description, contact_id, deal_id]
    icon: time
app_layout:
  primary_action: action_add_deal
  layout: dashboard
  sections:
    - type: entity-navigator
      entities: [pipeline, contacts, companies, deals, activities]
    - type: quick-actions
      actions: [action_add_contact, action_add_deal, action_log_activity]
site_pages:
  - slug: /contact
    template: contact
    data_source: ""
---

# CRM Module

Manages customer records, companies, deals, pipelines, and activities.

### action_add_contact
Add a new contact and link them to a company.
steps:
1. create(table='matter', type='customer', title={name}, data={name: {name}, phone: {phone}, email: {email}, role: {role}, source: {source}}, status='active')
2. link(src={id}, rel='works', tgt={company_id})

### action_get_contact
Retrieve a contact profile.
steps:
1. read(table='matter', type='customer', id={contact_id})

### action_add_company
Add a new company profile.
steps:
1. create(table='matter', type='customer', title={name}, data={name: {name}, industry: {industry}, size: {size}, website: {website}, address: {address}}, status='active')

### action_get_company
Retrieve company details.
steps:
1. read(table='matter', type='customer', id={company_id})

### action_add_deal
Add a new deal associated with a contact and company.
steps:
1. create(table='matter', type='deal', title={name}, value={value}, data={name: {name}, stage: {stage}, expected_close_date: {expected_close_date}}, status='active')
2. link(src={id}, rel='customer', tgt={contact_id})
3. create(table='motion', type='stage', ref={id}, data={stage: {stage}, value: {value}}, by='agent:taragent')

### action_update_deal_stage
Update a deal's pipeline stage.
steps:
1. update(table='matter', id={deal_id}, type='deal', data={stage: {stage}, win_loss_reason: {win_loss_reason}})
2. create(table='motion', type='stage', ref={deal_id}, data={stage: {stage}, win_loss_reason: {win_loss_reason}}, by='agent:taragent')

### action_log_activity
Log a communication activity.
steps:
1. create(table='motion', type='activity', ref={deal_id}, data={activity_type: {type}, description: {description}, contact_id: {contact_id}}, by='agent:taragent')
`,

  logistics: `---
type: skill
name: logistics
version: 1.0.0
actions:
  - name: action_create_shipment
    params: [order_id, address]
    icon: car
  - name: action_update_tracking
    params: [shipment_id, status]
    icon: location
app_layout:
  primary_action: action_create_shipment
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_shipment, action_update_tracking]
---

# Logistics Module

Tracks deliveries and shipments.

### action_create_shipment
Initiate shipment for order.
steps:
1. create(table='matter', type='shipment', title='Shipment', data={order_id: {order_id}, address: {address}}, status='active')
2. link(src={id}, rel='order', tgt={order_id})

### action_update_tracking
Update delivery tracking status.
steps:
1. update(table='matter', id={shipment_id}, type='shipment', status={status})
2. create(table='motion', type='change', ref={shipment_id}, data={status: {status}}, by='agent:taragent')
`,

  projects: `---
type: skill
name: projects
version: 1.0.0
actions:
  - name: action_create_task
    params: [title, description]
    icon: checkbox
  - name: action_update_task_status
    params: [task_id, status]
    icon: checkmark-circle
app_layout:
  primary_action: action_create_task
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_task, action_update_task_status]
---

# Projects Module

Tracks milestones, tasks, and issues inside the inbox.

### action_create_task
Create a project task.
steps:
1. create(table='matter', type='project', title={title}, data={description: {description}}, status='active')
2. create(table='inbox', type='project', title={title}, ref={id})

### action_update_task_status
Mark task status.
steps:
1. update(table='matter', id={task_id}, type='project', status={status})
2. create(table='motion', type='done', ref={task_id}, data={status: {status}}, by='agent:taragent')
`,

  hr: `---
type: skill
name: hr
version: 1.0.0
actions:
  - name: action_add_employee
    params: [name, role, salary]
    icon: people
  - name: action_clock_in
    params: [staff_id]
    icon: log-in
  - name: action_clock_out
    params: [staff_id]
    icon: log-out
app_layout:
  primary_action: action_add_employee
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_employee, action_clock_in, action_clock_out]
---

# HR Module

Manages staff profiles, attendance, and payroll.

### action_add_employee
Register a new staff member.
steps:
1. create(table='matter', type='staff', title={name}, data={name: {name}, role: {role}, salary: {salary}}, status='active')

### action_clock_in
Record employee clock-in.
steps:
1. create(table='motion', type='clockin', ref={staff_id}, by='agent:taragent')

### action_clock_out
Record employee clock-out.
steps:
1. create(table='motion', type='clockout', ref={staff_id}, by='agent:taragent')
`,

  lms: `---
type: skill
name: lms
version: 1.0.0
actions:
  - name: action_create_course
    params: [title, instructor]
    icon: book
app_layout:
  primary_action: action_create_course
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_course]
---

# LMS Module

Manages classes and courses.

### action_create_course
Publish a learning course.
steps:
1. create(table='matter', type='product', title={title}, data={instructor: {instructor}, category: 'course'}, status='active')
`,

  listings: `---
type: skill
name: listings
version: 1.0.0
actions:
  - name: action_add_listing
    params: [title, price, description]
    icon: pricetag
app_layout:
  primary_action: action_add_listing
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_listing]
site_pages:
  - slug: /catalog
    template: catalog-grid
    data_source: "matter WHERE type = 'listing'"
---

# Listings Module

Tracks real estate or catalog listings.

### action_add_listing
Add a new listing.
steps:
1. create(table='matter', type='listing', title={title}, value={price}, data={description: {description}}, status='active')
`,

  support: `---
type: skill
name: support
version: 1.0.0
actions:
  - name: action_create_ticket
    params: [customer_id, subject]
    icon: help-circle
app_layout:
  primary_action: action_create_ticket
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_ticket]
site_pages:
  - slug: /help
    template: contact
    data_source: ""
---

# Support Module

Customer support ticketing.

### action_create_ticket
File a support ticket.
steps:
1. create(table='matter', type='ticket', title={subject}, status='active')
2. link(src={id}, rel='customer', tgt={customer_id})
3. create(table='inbox', type='support', title={subject}, ref={id})
`,

  reports: `---
type: skill
name: reports
version: 1.0.0
actions:
  - name: action_report_daily_sales
    params: []
    icon: bar-chart
  - name: action_report_low_stock
    params: []
    icon: warning
app_layout:
  primary_action: action_report_daily_sales
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_report_daily_sales, action_report_low_stock]
---

# Reports Module

Generates SQL report charts.

### action_report_daily_sales
View daily sales.
steps:
1. read(table='matter', type='order', status='active')

### action_report_low_stock
View low stock items.
steps:
1. read(table='matter', type='product')
2. filter: qty <= minStock
`,

  expenses: `---
type: skill
name: expenses
version: 1.0.0
actions:
  - name: action_record_expense
    params: [category, amount, date]
    icon: cash
app_layout:
  primary_action: action_record_expense
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_expense]
---

# Expenses Module

Records business expenditures.

### action_record_expense
Log an expense.
steps:
1. create(table='matter', type='expense', title={category}, value={amount}, data={date: {date}}, status='active')
`,

  documents: `---
type: skill
name: documents
version: 1.0.0
actions:
  - name: action_upload_doc
    params: [name, url]
    icon: document
app_layout:
  primary_action: action_upload_doc
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_upload_doc]
---

# Documents Module

Stores links to business files.

### action_upload_doc
Add a document link.
steps:
1. create(table='matter', type='asset', title={name}, data={url: {url}}, status='active')
`,

  "team-chat": `---
type: skill
name: team-chat
version: 1.0.0
actions:
  - name: action_send_message
    params: [channel, text]
    icon: chatbubbles
app_layout:
  primary_action: action_send_message
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_send_message]
---

# Team Chat Module

Relays chat messages to Slack or Telegram.

### action_send_message
Post a message to chat channel.
steps:
1. create(table='motion', type='activity', data={channel: {channel}, text: {text}}, by='agent:taragent')
`
};
