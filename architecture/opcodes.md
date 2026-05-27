# TAR Event Opcodes & Write Optimization

This document lists standard `motion.opcode` values across the TAR Framework and their write/sync strategies to reduce Turso database storage and sync costs.

- **Append**: Inserts a new row (required for audit logs, ledger entries, accounting).
- **Status Update**: Updates the `status` column of the existing row in-place (saves DB size).
- **Local User**: Kept inside `user.db` locally, never synced to cloud.

---

## 100 - Commerce & Orders

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **101** | `SOLD` | Append (Inventory Log) | 0% (Audit trail) |
| **102** | `CART_ADD` | Local User (`user.db`) | 100% (No sync) |
| **103** | `CART_REMOVE` | Local User (`user.db`) | 100% (No sync) |
| **104** | `CHECKOUT` | Status Update | 80% (Shares order row) |
| **105** | `ORDER_PLACED` | Append (Initial Order) | 0% (Baseline) |
| **106** | `CONFIRMED` | Status Update (`ORDER_PLACED`) | 80% (Shares order row) |
| **107** | `PREPARING` | Status Update (`ORDER_PLACED`) | 80% (Shares order row) |
| **108** | `READY` | Status Update (`ORDER_PLACED`) | 80% (Shares order row) |
| **109** | `DELIVERED` | Status Update (`ORDER_PLACED`) | 80% (Shares order row) |
| **110** | `INVOICE_GENERATED` | Append (Financial Log) | 0% (Audit trail) |
| **111** | `REFUND` | Append (Financial Log) | 0% (Audit trail) |
| **112** | `RENEWAL_DUE` | Append (Subscription Log) | 0% (Audit trail) |
| **113** | `COUPON_APPLIED` | Append (Promo Log) | 0% (Audit trail) |
| **114** | `WISHLISTED` | Local User (`user.db`) | 100% (No sync) |

---

## 200 - POS & In-Store

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **201** | `SALE` | Append (Financial Log) | 0% (Audit trail) |
| **202** | `SHIFT_START` | Append (Roster Log) | 0% (Audit trail) |
| **203** | `BREAK` | Append (Roster Log) | 0% (Audit trail) |
| **204** | `SHIFT_END` | Append (Roster Log) | 0% (Audit trail) |
| **205** | `CASH_CLOSE` | Append (Roster Log) | 0% (Audit trail) |
| **206** | `ORDER_FIRE` | Append (Initial KDS) | 0% (Baseline) |
| **207** | `ITEM_READY` | Status Update (`ORDER_FIRE`) | 50% (Shares KDS row) |
| **208** | `TOKEN_ISSUED` | Append (Initial Token) | 0% (Baseline) |
| **209** | `TOKEN_CALLED` | Status Update (`TOKEN_ISSUED`) | 66% (Shares token row) |
| **210** | `TOKEN_SERVED` | Status Update (`TOKEN_ISSUED`) | 66% (Shares token row) |

---

## 300 - CRM & Customers

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **301** | `STORE_VISIT` | Append (Telemetry) | 0% (Audit trail) |
| **302** | `REVIEW` | Append (Feedback Log) | 0% (Audit trail) |
| **303** | `LEAD_CREATED` | Append (Initial Lead) | 0% (Baseline) |
| **304** | `CONTACTED` | Status Update (`LEAD_CREATED`) | 66% (Shares lead row) |
| **305** | `CONVERTED` | Status Update (`LEAD_CREATED`) | 66% (Shares lead row) |
| **306** | `TICKET_OPEN` | Append (Initial Ticket) | 0% (Baseline) |
| **307** | `REPLY` | Append (Chat Message) | 0% (Chat log) |
| **308** | `RESOLVED` | Status Update (`TICKET_OPEN`) | 50% (Shares ticket row) |
| **309** | `BIRTHDAY_OFFER_SENT` | Append (Promo Log) | 0% (Audit trail) |

---

## 400 - Logistics & Delivery

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **401** | `DISPATCHED` | Append (Initial Delivery) | 0% (Baseline) |
| **402** | `IN_TRANSIT` | Status Update (`DISPATCHED`) | 80% (Shares delivery row) |
| **403** | `DRIVER_ASSIGNED` | Status Update (`DISPATCHED`) | 80% (Shares delivery row) |
| **404** | `ETA_UPDATED` | Status Update (`DISPATCHED`) | 80% (Shares delivery row) |
| **405** | `TRANSFER_OUT` | Append (Inventory Log) | 0% (Audit trail) |
| **406** | `TRANSFER_IN` | Append (Inventory Log) | 0% (Audit trail) |
| **407** | `RETURN_REQUESTED` | Append (Initial Return) | 0% (Baseline) |
| **408** | `PICKUP_SCHEDULED` | Status Update (`RETURN_REQUESTED`) | 66% (Shares return row) |
| **409** | `PICKED_UP` | Status Update (`RETURN_REQUESTED`) | 66% (Shares return row) |
| **410** | `DELIVERY_ATTEMPT` | Status Update (`DISPATCHED`) | 80% (Shares delivery row) |

---

## 500 - Staff & HR

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **501** | `CLOCK_IN` | Append (Attendance Log) | 0% (Audit trail) |
| **502** | `CLOCK_OUT` | Append (Attendance Log) | 0% (Audit trail) |
| **503** | `PAYROLL` | Append (Financial Log) | 0% (Audit trail) |
| **504** | `TASK_ASSIGNED` | Local User (`user.db`) | 100% (No sync) |
| **505** | `PERFORMANCE_NOTE` | Append (Audit Log) | 0% (Audit trail) |
| **506** | `LEAVE_REQUESTED` | Append (Initial Request) | 0% (Baseline) |
| **507** | `APPROVED` | Status Update (`LEAVE_REQUESTED`) | 50% (Shares leave row) |
| **508** | `REJECTED` | Status Update (`LEAVE_REQUESTED`) | 50% (Shares leave row) |

---

## 600 - Marketing & Campaigns

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **601** | `PUSH_SENT` | Append (Telemetry) | 0% (Audit trail) |
| **602** | `SMS_SENT` | Append (Telemetry) | 0% (Audit trail) |
| **603** | `REFERRAL` | Append (Referral Log) | 0% (Audit trail) |

---

## 700 - Scheduling & Bookings

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **701** | `BOOKED` | Append (Initial Booking) | 0% (Baseline) |
| **702** | `COMPLETED` | Status Update (`BOOKED`) | 66% (Shares booking row) |
| **703** | `CANCELLED` | Status Update (`BOOKED`) | 66% (Shares booking row) |

---

## 800 - Payments

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **801** | `PAYMENT_INITIATED` | Append (Initial Payment) | 0% (Baseline) |
| **802** | `PAYMENT_SUCCESS` | Status Update (`PAYMENT_INITIATED`) | 75% (Shares payment row) |
| **803** | `PARTIAL_PAYMENT` | Status Update (`PAYMENT_INITIATED`) | 75% (Shares payment row) |
| **804** | `PAYOUT` | Append (Financial Log) | 0% (Audit trail) |
| **805** | `PAYMENT_FAILED` | Status Update (`PAYMENT_INITIATED`) | 75% (Shares payment row) |

---

## 900 - Services (Non-Product)

| ID | Opcode | Write Strategy | Storage Savings |
| :--- | :--- | :--- | :--- |
| **901** | `BOOKING` | Append (Initial Booking) | 0% (Baseline) |
| **902** | `ASSIGNED` | Status Update (`BOOKING`) | 50% (Shares booking row) |
| **903** | `RIDE_REQUESTED` | Append (Initial Ride) | 0% (Baseline) |
| **904** | `DRIVER_MATCHED` | Status Update (`RIDE_REQUESTED`) | 66% (Shares ride row) |
| **905** | `IN_RIDE` | Status Update (`RIDE_REQUESTED`) | 66% (Shares ride row) |

