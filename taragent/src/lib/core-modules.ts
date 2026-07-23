export const CORE_MODULES: Record<string, string> = {
  orders: `---
type: skill
name: orders
version: 1.0.0
actions:
  - name: action_record_sale
    params: [items, payment_method, total, customer_id]
    icon: receipt
  - name: action_update_order_status
    params: [order_id, status]
    icon: sync
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
      actions: [action_record_sale, action_update_order_status, action_refund_order, action_void_order]
    - type: metric-card
      title: "Today's Sales"
      variant: "hero-chart"
      theme: "mint"
      data: "SELECT SUM(value) FROM matter WHERE type='order' AND status='active'"
    - type: status-board
      title: "Order Fulfillment"
      props: { type: "order", groupBy: "status" }
    - type: data-grid
      title: "Order History"
      props: { type: "order", mode: "table" }
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

Handles POS transactions, checkout, order fulfillment status, refunds, and sales logging.

### action_record_sale
Record a new customer purchase.
steps:
1. create(table='matter', type='order', title='Sale', value={total}, data={payment_method: {payment_method}, line_items: {items}}, status='active')
2. create(table='motion', type='sale', ref={id}, data={total: {total}}, by='agent:taragent')
3. link(src={id}, rel='customer', tgt={customer_id})
4. create(table='inbox', type='order', title='New order', ref={id})

### action_update_order_status
Update order fulfillment status (e.g. pending -> preparing -> ready -> completed).
steps:
1. update(table='matter', id={order_id}, type='order', status={status})
2. create(table='motion', type='status_change', ref={order_id}, data={status: {status}}, by='agent:taragent')

### action_refund_order
Issue a full or partial refund for an order.
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
  - name: action_check_stock
    params: []
    icon: list
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
      actions: [action_add_product, action_check_stock, action_adjust_stock, action_write_off]
    - type: metric-card
      title: "Low Stock Items"
      data: "SELECT COUNT(*) FROM matter WHERE type='product' AND value <= 5"
    - type: data-grid
      title: "Product Inventory"
      props: { type: "product", mode: "grid" }
site_pages:
  - slug: /catalog
    template: catalog-grid
    data_source: "matter WHERE type = 'product'"
---

# Inventory Module

Tracks stock levels, adds products, adjusts quantities, and logs inventory write-offs.

### action_add_product
Add a new item to catalog.
steps:
1. create(table='matter', type='product', title={name}, value={stock}, data={price: {price}, category: {category}}, status='active')

### action_check_stock
Query inventory levels.
steps:
1. read(table='matter', type='product', status='active')

### action_adjust_stock
Adjust stock count.
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

  bookings: `---
type: skill
name: bookings
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
site_pages:
  - slug: /book
    template: booking-widget
    data_source: "matter WHERE type = 'service'"
---

# Bookings Module

Manages appointments, schedules, slot reservations, and cancellations.

### action_book_slot
Create an appointment booking.
steps:
1. create(table='matter', type='booking', title='Booking', data={service: {service}, date: {date}, slot: {slot}, customer_id: {customer_id}}, status='active')
2. create(table='motion', type='booking', ref={id}, data={service: {service}}, by='agent:taragent')
3. link(src={id}, rel='customer', tgt={customer_id})
4. create(table='inbox', type='booking', title='Booking', ref={id}, due={due})

### action_update_booking_status
Update appointment status (e.g. confirmed, completed, no-show).
steps:
1. update(table='matter', id={booking_id}, type='booking', status={status})
2. create(table='motion', type='status_change', ref={booking_id}, data={status: {status}}, by='agent:taragent')

### action_cancel_booking
Cancel a booking.
steps:
1. update(table='matter', id={booking_id}, type='booking', status='cancelled', data={reason: {reason}})
2. create(table='motion', type='cancel', ref={booking_id}, data={reason: {reason}}, by='agent:taragent')
`,

  crm: `---
type: skill
name: crm
version: 1.0.0
actions:
  - name: action_add_contact
    params: [name, phone, email, company_id, role]
    icon: person-add
  - name: action_add_company
    params: [name, industry, website, address]
    icon: business
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
  primary_action: action_add_deal
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
    - type: data-grid
      title: "Contacts & Clients"
      props: { type: "customer", mode: "table" }
site_pages:
  - slug: /contact
    template: contact
    data_source: ""
---

# CRM Module

Manages customer records, companies, deals, pipelines, and activity logs.

### action_add_contact
Add a new contact and link to company.
steps:
1. create(table='matter', type='customer', title={name}, data={phone: {phone}, email: {email}, role: {role}}, status='active')
2. link(src={id}, rel='works_at', tgt={company_id})

### action_add_company
Add a company profile.
steps:
1. create(table='matter', type='customer', title={name}, data={industry: {industry}, website: {website}, address: {address}}, status='active')

### action_add_deal
Create a new sales deal.
steps:
1. create(table='matter', type='deal', title={name}, value={value}, data={stage: {stage}, expected_close_date: {expected_close_date}}, status='active')
2. link(src={id}, rel='customer', tgt={contact_id})
3. create(table='motion', type='stage', ref={id}, data={stage: {stage}, value: {value}}, by='agent:taragent')

### action_update_deal_stage
Advance deal pipeline stage.
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

# Logistics Module

Tracks deliveries, carrier shipments, tracking updates, and proof of delivery.

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

  projects: `---
type: skill
name: projects
version: 1.0.0
actions:
  - name: action_create_task
    params: [title, description, assignee_id, due_date]
    icon: checkbox
  - name: action_update_task_status
    params: [task_id, status]
    icon: checkmark-circle
  - name: action_assign_task
    params: [task_id, assignee_id]
    icon: person
app_layout:
  primary_action: action_create_task
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_task, action_update_task_status, action_assign_task]
    - type: metric-card
      title: "Open Tasks"
      data: "SELECT COUNT(*) FROM matter WHERE type='project' AND status!='completed'"
    - type: status-board
      title: "Task Kanban Board"
      props: { type: "project", groupBy: "status" }
    - type: data-grid
      title: "All Tasks"
      props: { type: "project", mode: "list" }
---

# Projects Module

Manages project tasks, milestones, assignments, and Kanban progress boards.

### action_create_task
Create a project task.
steps:
1. create(table='matter', type='project', title={title}, data={description: {description}, due_date: {due_date}}, status='todo')
2. create(table='inbox', type='project', title={title}, ref={id}, due={due_date})
3. link(src={id}, rel='assigned_to', tgt={assignee_id})

### action_update_task_status
Update task status (e.g. todo -> in_progress -> review -> completed).
steps:
1. update(table='matter', id={task_id}, type='project', status={status})
2. create(table='motion', type='status_change', ref={task_id}, data={status: {status}}, by='agent:taragent')

### action_assign_task
Reassign task to staff member.
steps:
1. link(src={task_id}, rel='assigned_to', tgt={assignee_id})
2. create(table='motion', type='assignment', ref={task_id}, data={assignee_id: {assignee_id}}, by='agent:taragent')
`,

  hr: `---
type: skill
name: hr
version: 1.0.0
actions:
  - name: action_add_employee
    params: [name, role, salary, phone]
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
    - type: metric-card
      title: "Active Staff Today"
      data: "SELECT COUNT(*) FROM matter WHERE type='staff' AND status='active'"
    - type: data-grid
      title: "Employee Directory & Attendance"
      props: { type: "staff", mode: "table" }
---

# HR Module

Manages staff profiles, attendance clock-in/out, and employee records.

### action_add_employee
Register a new staff member.
steps:
1. create(table='matter', type='staff', title={name}, data={role: {role}, salary: {salary}, phone: {phone}}, status='active')

### action_clock_in
Record employee clock-in.
steps:
1. create(table='motion', type='clockin', ref={staff_id}, by='agent:taragent')

### action_clock_out
Record employee clock-out.
steps:
1. create(table='motion', type='clockout', ref={staff_id}, by='agent:taragent')
`,

  expenses: `---
type: skill
name: expenses
version: 1.0.0
actions:
  - name: action_record_expense
    params: [category, amount, description, date]
    icon: cash
  - name: action_categorize_expense
    params: [expense_id, category]
    icon: pricetag
app_layout:
  primary_action: action_record_expense
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_expense, action_categorize_expense]
    - type: metric-card
      title: "Total Expenses (Month)"
      data: "SELECT SUM(value) FROM matter WHERE type='expense' AND status='active'"
    - type: data-grid
      title: "Expense Log"
      props: { type: "expense", mode: "table" }
---

# Expenses Module

Logs business expenditure, categorizes costs, and tracks total outflow.

### action_record_expense
Log an expense payout.
steps:
1. create(table='matter', type='expense', title={category}, value={amount}, data={description: {description}, date: {date}}, status='active')
2. create(table='motion', type='expense', ref={id}, data={amount: {amount}}, by='agent:taragent')

### action_categorize_expense
Re-categorize expense.
steps:
1. update(table='matter', id={expense_id}, type='expense', title={category})
`,

  listings: `---
type: skill
name: listings
version: 1.0.0
actions:
  - name: action_add_listing
    params: [title, price, description, category]
    icon: pricetag
  - name: action_update_listing_status
    params: [listing_id, status]
    icon: sync
app_layout:
  primary_action: action_add_listing
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_add_listing, action_update_listing_status]
    - type: data-grid
      title: "Catalog Listings"
      props: { type: "listing", mode: "grid" }
site_pages:
  - slug: /catalog
    template: catalog-grid
    data_source: "matter WHERE type = 'listing'"
---

# Listings Module

Tracks real estate, rental, or catalog items.

### action_add_listing
Add a new listing.
steps:
1. create(table='matter', type='listing', title={title}, value={price}, data={description: {description}, category: {category}}, status='active')

### action_update_listing_status
Update listing availability status (active, sold, pending).
steps:
1. update(table='matter', id={listing_id}, type='listing', status={status})
`,

  support: `---
type: skill
name: support
version: 1.0.0
actions:
  - name: action_create_ticket
    params: [customer_id, subject, priority]
    icon: help-circle
  - name: action_update_ticket_status
    params: [ticket_id, status]
    icon: checkmark-circle
app_layout:
  primary_action: action_create_ticket
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_ticket, action_update_ticket_status]
    - type: metric-card
      title: "Open Tickets"
      data: "SELECT COUNT(*) FROM matter WHERE type='ticket' AND status!='resolved'"
    - type: status-board
      title: "Ticket Status Board"
      props: { type: "ticket", groupBy: "status" }
site_pages:
  - slug: /help
    template: contact
    data_source: ""
---

# Support Module

Customer support ticket management.

### action_create_ticket
File a support ticket.
steps:
1. create(table='matter', type='ticket', title={subject}, data={priority: {priority}}, status='open')
2. link(src={id}, rel='customer', tgt={customer_id})
3. create(table='inbox', type='support', title={subject}, ref={id})

### action_update_ticket_status
Resolve or reassign support ticket.
steps:
1. update(table='matter', id={ticket_id}, type='ticket', status={status})
2. create(table='motion', type='status_change', ref={ticket_id}, data={status: {status}}, by='agent:taragent')
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
    - type: metric-card
      title: "Revenue Insights"
      variant: "hero-chart"
      theme: "mint"
      data: "SELECT SUM(value) FROM matter WHERE type='order' AND status='active'"
---

# Reports Module

Generates analytical SQL charts and summary business insights.

### action_report_daily_sales
Generate daily sales report.
steps:
1. read(table='matter', type='order', status='active')

### action_report_low_stock
Generate low stock warning list.
steps:
1. read(table='matter', type='product')
`,

  documents: `---
type: skill
name: documents
version: 1.0.0
actions:
  - name: action_upload_doc
    params: [name, url, category]
    icon: document
  - name: action_archive_doc
    params: [doc_id]
    icon: archive
app_layout:
  primary_action: action_upload_doc
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_upload_doc, action_archive_doc]
    - type: data-grid
      title: "Document Vault"
      props: { type: "asset", mode: "list" }
---

# Documents Module

Stores links to business files, receipts, contracts, and legal documents.

### action_upload_doc
Add a document link.
steps:
1. create(table='matter', type='asset', title={name}, data={url: {url}, category: {category}}, status='active')

### action_archive_doc
Archive document.
steps:
1. update(table='matter', id={doc_id}, type='asset', status='archived')
`,

  lms: `---
type: skill
name: lms
version: 1.0.0
actions:
  - name: action_create_course
    params: [title, instructor, price]
    icon: book
  - name: action_enroll_student
    params: [course_id, student_id]
    icon: school
app_layout:
  primary_action: action_create_course
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_create_course, action_enroll_student]
    - type: data-grid
      title: "Courses & Classes"
      props: { type: "product", mode: "grid" }
---

# LMS Module

Manages classes, courses, and student enrollments.

### action_create_course
Publish a learning course.
steps:
1. create(table='matter', type='product', title={title}, value={price}, data={instructor: {instructor}, category: 'course'}, status='active')

### action_enroll_student
Enroll a student in a course.
steps:
1. link(src={course_id}, rel='enrolled_student', tgt={student_id})
2. create(table='motion', type='enrollment', ref={course_id}, data={student_id: {student_id}}, by='agent:taragent')
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
    - type: data-grid
      title: "Message Stream"
      props: { type: "inbox", mode: "list" }
---

# Team Chat Module

Relays internal chat messages and notifications across group channels.

### action_send_message
Post a message to chat channel.
steps:
1. create(table='motion', type='activity', data={channel: {channel}, text: {text}}, by='agent:taragent')
`
};
