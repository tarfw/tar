# TAR Event Opcodes

This document lists all the standard `motion.opcode` values across the TAR Framework. They are grouped by domain and assigned a unique numeric ID (which can be used for optimized database storage or enums).

## 100 - Commerce & Orders
* **101** - `SOLD` (Inventory deduction)
* **102** - `CART_ADD`
* **103** - `CART_REMOVE`
* **104** - `CHECKOUT`
* **105** - `ORDER_PLACED`
* **106** - `CONFIRMED`
* **107** - `PREPARING`
* **108** - `READY`
* **109** - `DELIVERED`
* **110** - `INVOICE_GENERATED`
* **111** - `REFUND`
* **112** - `RENEWAL_DUE`
* **113** - `COUPON_APPLIED`
* **114** - `WISHLISTED`

## 200 - POS & In-Store
* **201** - `SALE` (Cash register transaction)
* **202** - `SHIFT_START`
* **203** - `BREAK`
* **204** - `SHIFT_END`
* **205** - `CASH_CLOSE`
* **206** - `ORDER_FIRE` (KDS)
* **207** - `ITEM_READY` (KDS)
* **208** - `TOKEN_ISSUED`
* **209** - `TOKEN_CALLED`
* **210** - `TOKEN_SERVED`

## 300 - CRM & Customers
* **301** - `STORE_VISIT`
* **302** - `REVIEW`
* **303** - `LEAD_CREATED`
* **304** - `CONTACTED`
* **305** - `CONVERTED`
* **306** - `TICKET_OPEN`
* **307** - `REPLY`
* **308** - `RESOLVED`
* **309** - `BIRTHDAY_OFFER_SENT`

## 400 - Logistics & Delivery
* **401** - `DISPATCHED`
* **402** - `IN_TRANSIT`
* **403** - `DRIVER_ASSIGNED`
* **404** - `ETA_UPDATED`
* **405** - `TRANSFER_OUT`
* **406** - `TRANSFER_IN`
* **407** - `RETURN_REQUESTED`
* **408** - `PICKUP_SCHEDULED`
* **409** - `PICKED_UP`
* **410** - `DELIVERY_ATTEMPT`

## 500 - Staff & HR
* **501** - `CLOCK_IN`
* **502** - `CLOCK_OUT`
* **503** - `PAYROLL`
* **504** - `TASK_ASSIGNED`
* **505** - `PERFORMANCE_NOTE`
* **506** - `LEAVE_REQUESTED`
* **507** - `APPROVED`
* **508** - `REJECTED`

## 600 - Marketing & Campaigns
* **601** - `PUSH_SENT`
* **602** - `SMS_SENT`
* **603** - `REFERRAL`

## 700 - Scheduling & Bookings
* **701** - `BOOKED`
* **702** - `COMPLETED`
* **703** - `CANCELLED`

## 800 - Payments
* **801** - `PAYMENT_INITIATED`
* **802** - `PAYMENT_SUCCESS`
* **803** - `PARTIAL_PAYMENT`
* **804** - `PAYOUT`
* **805** - `PAYMENT_FAILED`

## 900 - Services (Non-Product)
* **901** - `BOOKING`
* **902** - `ASSIGNED`
* **903** - `RIDE_REQUESTED`
* **904** - `DRIVER_MATCHED`
* **905** - `IN_RIDE`
