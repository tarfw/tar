# Modules

14 capability modules. All are `form` rows — install = copy rows. No code deployment.

## Module list

| # | Module | Folder | Key concepts |
|---|---|---|---|
| 1 | [CRM](/modules/crm.md) | crm/ | Leads, follow-ups, deal pipeline |
| 2 | [Projects](/modules/projects.md) | projects/ | Tasks, sprints, milestones |
| 3 | [Bookings](/modules/bookings.md) | bookings/ | Appointments, slots, reminders |
| 4 | [Inventory](/modules/inventory.md) | inventory/ | Stock, batch/expiry, suppliers |
| 5 | [Orders](/modules/orders.md) | orders/ | POS, GST, loyalty, multi-currency |
| 6 | [Logistics](/modules/logistics.md) | logistics/ | Delivery, drivers, routing |
| 7 | [HR](/modules/hr.md) | hr/ | Attendance, leave, payroll |
| 8 | [LMS](/modules/lms.md) | lms/ | Courses, assignments, completion |
| 9 | [Listings](/modules/listings.md) | listings/ | Property/products, inquiries |
| 10 | [Support](/modules/support.md) | support/ | Tickets, chat, escalation |
| 11 | [Team Chat](/modules/team-chat.md) | team-chat/ | Internal messaging |
| 12 | [Reports](/modules/reports.md) | reports/ | Sales, stock, tax, revenue |
| 13 | [Expenses](/modules/expenses.md) | expenses/ | Tracking, recurring, bills |
| 14 | [Documents](/modules/documents.md) | documents/ | Railway S3, linking, presigned URLs |

## Module composition by business type

| Business | Modules |
|---|---|
| Restaurant / Cafe | Orders + Inventory + Bookings + CRM + Reports + Expenses + Documents |
| Pet Salon | Bookings + CRM + Orders + Reports + Expenses + Documents |
| Dental / Clinic | Bookings + CRM + Projects + Support + Reports + Expenses + Documents |
| Retail Store | Orders + Inventory + CRM + Reports + Expenses + Documents |
| Gym / Yoga | Bookings + CRM + LMS + HR + Reports + Expenses + Documents |
| Food Delivery | Orders + Inventory + Logistics + CRM + Reports + Expenses + Documents |
| Taxi / Ride | Logistics + Orders + CRM + Reports + Expenses + Documents |

## How modules install

```
User describes business in chat
  → Agent detects intent (cheap LLM)
  → Agent matches business type to module set
  → Agent copies form rows into workspace scope
  → Agent generates site layout (one LLM call)
  → Workspace goes live
```

Each module = bundle of `form` rows. Installing = copying rows. No code. No schema migration.

## Related

- [Architecture](/architecture/overview.md) — how modules fit in the system
- [Playbooks](/playbooks/module-installation.md) — step-by-step install process
