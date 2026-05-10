# TAR Use Cases — 4 Tables, Every Domain

Pattern: `matter` = what it is, `mass` = where/how much/price, `motion` = what happened, `memory` = vector search

---

## Commerce

| Use Case | Example |
|---|---|
| Product catalog | matter: "Chettinad Chicken Biryani", mass: store=Adyar, qty=50, ₹180 |
| Inventory tracking | mass.qty decrements on each sale, motion: SOLD delta=-1 |
| Multi-store pricing | Same matter.code, two masses: Adyar ₹180, T.Nagar ₹200 |
| Flash sale / time window | mass.startts=6pm, endts=9pm, value=₹99 |
| Variant management | matter payload: {sizes:["S","M","L"], colors:["Red","Blue"]} |
| Cart | motion stream: CART_ADD, CART_REMOVE, CHECKOUT per user |
| Order lifecycle | motion stream: ORDER_PLACED → CONFIRMED → PREPARING → READY → DELIVERED |
| Invoice / billing | motion: INVOICE_GENERATED payload={items, tax, total} |
| Refund / return | motion: REFUND delta=-₹180, linked to original order streamid |
| Subscription / recurring | mass with endts=renewal date, motion: RENEWAL_DUE |
| Coupon / discount | matter type=coupon, mass.qty=usage limit, motion: COUPON_APPLIED |
| Wishlist | motion: WISHLISTED per user, stream=user |
| Bundle / combo | matter type=bundle, payload={child_ucodes:["biryani","raita","coke"]} |

---

## POS / In-Store

| Use Case | Example |
|---|---|
| Cash register sale | motion: POS_SALE opcode=SALE, delta=₹540, scope=store |
| Shift management | motion stream: SHIFT_START → BREAK → SHIFT_END per staff |
| Daily cash close | motion: CASH_CLOSE payload={expected:₹45000, actual:₹44800} |
| Table management | matter type=table, mass: scope=restaurant, available=1/0 |
| KDS (kitchen display) | motion: ORDER_FIRE → ITEM_READY per order item |
| Queue / token system | motion stream: TOKEN_ISSUED → TOKEN_CALLED → TOKEN_SERVED |

---

## CRM / Customers

| Use Case | Example |
|---|---|
| Customer profile | matter type=customer, payload={name, phone, segment} |
| Loyalty points | mass: matter=customer, value=1200 (points balance) |
| Visit tracking | motion: STORE_VISIT per customer per store |
| Feedback / review | motion: REVIEW payload={rating:4, text:"great biryani"} |
| Customer segment | matter type=segment, payload={rules:"spent>5000 last 30d"} |
| Lead / prospect | matter type=lead, motion stream: LEAD_CREATED → CONTACTED → CONVERTED |
| Support ticket | motion stream: TICKET_OPEN → REPLY → RESOLVED |
| Birthday / anniversary offers | matter payload={dob:"1990-05-15"}, motion: BIRTHDAY_OFFER_SENT |

---

## Sites / Storefronts

| Use Case | Example |
|---|---|
| Store page | matter type=store, payload={name, logo, banner, theme, hours} |
| Section / category | matter type=section, payload={title:"Lunch Menu", display_order:1} |
| Page / landing page | matter type=page, payload={html, slug:"/about-us"} |
| Banner / hero | matter type=banner, payload={image_url, link, position} |
| Menu / navigation | matter type=menu, payload={items:[{label, href}]} |
| SEO metadata | matter payload includes {meta_title, meta_desc, og_image} |
| Multi-store chain | Multiple store matter, masses link products to each |
| Store hours | matter payload={hours:{mon:"9-21", tue:"9-21"}} |

---

## Logistics / Delivery

| Use Case | Example |
|---|---|
| Delivery tracking | motion stream: DISPATCHED → IN_TRANSIT(lat,lng) → DELIVERED |
| Driver assignment | motion: DRIVER_ASSIGNED payload={driver_id, vehicle} |
| Route / ETA | motion: ETA_UPDATED payload={eta_mins:12} |
| Warehouse / hub | matter type=warehouse, masses=stock per SKU at that hub |
| Transfer between stores | motion: TRANSFER_OUT(store A) + TRANSFER_IN(store B), delta=±qty |
| Return pickup | motion stream: RETURN_REQUESTED → PICKUP_SCHEDULED → PICKED_UP |
| Last-mile status | motion: DELIVERY_ATTEMPT payload={result:"customer_unavailable"} |

---

## Staff / HR

| Use Case | Example |
|---|---|
| Employee record | matter type=employee, payload={role, phone, joined} |
| Attendance | motion: CLOCK_IN lat/lng, CLOCK_OUT per day |
| Payroll entry | motion: PAYROLL delta=₹25000, scope=store |
| Task assignment | motion: TASK_ASSIGNED payload={task, assignee, due} |
| Performance note | motion: PERFORMANCE_NOTE payload={note, rating} |
| Leave request | motion stream: LEAVE_REQUESTED → APPROVED/REJECTED |

---

## Marketing / Campaigns

| Use Case | Example |
|---|---|
| Campaign | matter type=campaign, payload={message, audience, channel} |
| Push notification | motion: PUSH_SENT scope=campaign, per user |
| SMS blast | motion: SMS_SENT payload={phone, template} |
| A/B test variant | matter type=ab_variant, masses: variant_a vs variant_b |
| Referral tracking | motion: REFERRAL payload={referrer, referee, reward} |
| Promo code | matter type=promo, mass.qty=remaining uses |

---

## Analytics / Reporting

| Use Case | Example |
|---|---|
| Sales dashboard | SUM(motion.delta) WHERE opcode=SALE GROUP BY scope, day |
| Top products | COUNT motion WHERE opcode=SOLD GROUP BY matter |
| Peak hours | COUNT motion GROUP BY HOUR(ts) |
| Customer LTV | SUM(motion.delta) WHERE stream=customer_id |
| Conversion funnel | COUNT motion per opcode: VIEW → CART → CHECKOUT → PAID |
| Geo heatmap | motion grouped by lat/lng or mass.h3 |

---

## Scheduling / Bookings

| Use Case | Example |
|---|---|
| Appointment slot | mass: scope=salon, startts=10:00, endts=10:30, available=1 |
| Booking | motion: BOOKED → CONFIRMED → COMPLETED per appointment |
| Class / motion registration | matter type=class, mass.qty=seats remaining |
| Recurring schedule | multiple masses same matter, different startts/endts |
| Cancellation | motion: CANCELLED, mass.available=1 restored |

---

## Payments

| Use Case | Example |
|---|---|
| UPI payment | motion: PAYMENT_INITIATED → PAYMENT_SUCCESS delta=₹540 |
| Partial payment | motion: PARTIAL_PAYMENT delta=₹200, remaining in payload |
| Split bill | multiple PAYMENT motion on same order stream |
| Payout to seller | motion: PAYOUT delta=₹4800, scope=store |
| Payment failure | motion: PAYMENT_FAILED payload={reason:"timeout"} |

---

## Services (Non-Product)

| Use Case | Example |
|---|---|
| Plumber listing | matter type=service, title="Pipe repair", mass: scope=plumber, value=₹500, h3=Adyar |
| Tutor booking | matter type=tutor, mass: available=1, startts/endts slots |
| Cab / auto ride | motion stream: RIDE_REQUESTED → DRIVER_MATCHED → IN_RIDE → COMPLETED |
| Tiffin service | matter type=meal_plan, mass: qty=30(days), value=₹3000/mo |
| Home cleaning | matter type=service, motion: BOOKING → ASSIGNED → COMPLETED |

---

**Total: 70+ use cases across 12 domains** — all on `matter`, `mass`, `motion`, `memory`.
