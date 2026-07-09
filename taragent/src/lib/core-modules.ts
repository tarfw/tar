export const CORE_MODULES: Record<string, string> = {
  orders: `---
type: skill
name: orders
version: 1.0.0
actions:
  - name: action_record_sale
    params: [items, payment_method]
    icon: receipt
  - name: action_void_order
    params: [order_id, reason]
    icon: x-circle
ui_hints:
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
1. create(table='matter', type='order', title='Sale', data={items: {items}, payment_method: {payment_method}})
2. create(table='motion', type='sale', data={items: {items}, payment_method: {payment_method}})

### action_void_order
Void a transaction.
steps:
1. update(table='matter', id={order_id}, type='order', status='voided')
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
    icon: plus-circle
ui_hints:
  primary_action: action_check_stock
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_check_stock, action_add_stock]
    - type: metric-card
      title: "Low Stock Alert"
      data: "SELECT COUNT(*) FROM matter WHERE type='product' AND qty <= 5"
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
1. read(table='matter', type='product')

### action_add_stock
Adjust stock quantity.
steps:
1. update(table='matter', id={product_id}, type='product', qty={qty})
`,

  bookings: `---
type: skill
name: bookings
version: 1.0.0
actions:
  - name: action_book_slot
    params: [service, date, slot]
    icon: calendar
  - name: action_cancel_booking
    params: [booking_id]
    icon: calendar-x
ui_hints:
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
Create an appointment slot.
steps:
1. create(table='matter', type='booking', title='Booking', data={service: {service}, date: {date}, slot: {slot}, status: 'confirmed'})

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
  - name: action_add_customer
    params: [name, phone, email]
    icon: person-add
  - name: action_get_customer
    params: [customer_id]
    icon: person
ui_hints:
  primary_action: action_add_customer
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_customer, action_get_customer]
site_pages:
  - slug: /contact
    template: contact
    data_source: ""
---

# CRM Module

Manages customer records and relations.

### action_add_customer
Add new customer details.
steps:
1. create(table='matter', type='customer', title={name}, data={name: {name}, phone: {phone}, email: {email}})

### action_get_customer
Retrieve customer profile.
steps:
1. read(table='matter', type='customer', id={customer_id})
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
ui_hints:
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
1. create(table='matter', type='shipment', title='Shipment', data={order_id: {order_id}, address: {address}, status: 'dispatched'})

### action_update_tracking
Update delivery tracking status.
steps:
1. update(table='matter', id={shipment_id}, type='shipment', status={status})
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
ui_hints:
  primary_action: action_create_task
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_task, action_update_task_status]
---

# Projects Module

Tracks milestones, tasks, and issues.

### action_create_task
Create a project task.
steps:
1. create(table='matter', type='task', title={title}, data={title: {title}, description: {description}, status: 'pending'})

### action_update_task_status
Mark task status.
steps:
1. update(table='matter', id={task_id}, type='task', status={status})
`,

  hr: `---
type: skill
name: hr
version: 1.0.0
actions:
  - name: action_add_employee
    params: [name, role, salary]
    icon: people
ui_hints:
  primary_action: action_add_employee
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_employee]
---

# HR Module

Manages staff profiles and payroll.

### action_add_employee
Register a new staff member.
steps:
1. create(table='matter', type='employee', title={name}, data={name: {name}, role: {role}, salary: {salary}})
`,

  lms: `---
type: skill
name: lms
version: 1.0.0
actions:
  - name: action_create_course
    params: [title, instructor]
    icon: book
ui_hints:
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
1. create(table='matter', type='course', title={title}, data={title: {title}, instructor: {instructor}})
`,

  listings: `---
type: skill
name: listings
version: 1.0.0
actions:
  - name: action_add_listing
    params: [title, price, description]
    icon: pricetag
ui_hints:
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
1. create(table='matter', type='listing', title={title}, value={price}, data={title: {title}, description: {description}})
`,

  support: `---
type: skill
name: support
version: 1.0.0
actions:
  - name: action_create_ticket
    params: [customer_id, subject]
    icon: help-circle
ui_hints:
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
1. create(table='matter', type='ticket', title={subject}, data={customer_id: {customer_id}, subject: {subject}, status: 'open'})
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
ui_hints:
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
1. read(table='matter', type='order')

### action_report_low_stock
View low stock items.
steps:
1. read(table='matter', type='product')
`,

  expenses: `---
type: skill
name: expenses
version: 1.0.0
actions:
  - name: action_record_expense
    params: [category, amount, date]
    icon: cash
ui_hints:
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
1. create(table='matter', type='expense', title={category}, value={amount}, data={category: {category}, amount: {amount}, date: {date}})
`,

  documents: `---
type: skill
name: documents
version: 1.0.0
actions:
  - name: action_upload_doc
    params: [name, url]
    icon: document
ui_hints:
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
1. create(table='matter', type='document', title={name}, data={name: {name}, url: {url}})
`,

  "team-chat": `---
type: skill
name: team-chat
version: 1.0.0
actions:
  - name: action_send_message
    params: [channel, text]
    icon: chatbubbles
ui_hints:
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
1. create(table='matter', type='chat_message', title={channel}, data={channel: {channel}, text: {text}})
`
};
