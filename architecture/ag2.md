If you want to power these 70+ use cases using a **Multi-Agent System**, the best way to divide them is by giving each AI Agent a specific "Job Title" or domain.

Each Agent operates on the same Turso database (`matter`, `mass`, `motion`), but their prompts, permissions, and focus areas are specialized. Here is how you can divide those use cases under 6 specialized AI Agents:

### 1. 🛍️ The Commerce Agent (Sales & Catalog)

_Responsible for everything a customer buys and how products are presented._

- Product catalog
- Inventory tracking
- Multi-store pricing
- Flash sale / time window
- Variant management
- Bundle / combo
- Cart
- Order lifecycle
- Refund / return
- Subscription / recurring
- Wishlist
- Cash register sale
- KDS (kitchen display)

### 2. 🚚 The Operations Agent (Logistics & Routing)

_Responsible for moving things around and managing physical space/time._

- Delivery tracking
- Driver assignment
- Route / ETA
- Warehouse / hub
- Transfer between stores
- Return pickup
- Last-mile status
- Table management
- Queue / token system
- Store hours

### 3. 📢 The Growth Agent (Marketing & CRM)

_Responsible for customer relationships, retention, and outbound messaging._

- Customer profile
- Loyalty points
- Visit tracking
- Feedback / review
- Customer segment
- Lead / prospect
- Birthday / anniversary offers
- Campaign
- Push notification
- SMS blast
- A/B test variant
- Referral tracking
- Promo code
- Coupon / discount

### 4. 💼 The Manager Agent (HR & Services)

_Responsible for internal team management and service bookings._

- Employee record
- Attendance
- Task assignment
- Performance note
- Leave request
- Shift management
- Support ticket
- Appointment slot
- Booking
- Class / motion registration
- Recurring schedule
- Cancellation
- Plumber listing
- Tutor booking
- Cab / auto ride
- Tiffin service
- Home cleaning

### 5. 💰 The Finance Agent (Payments & Analytics)

_Responsible for money movement, billing, and reporting._

- Invoice / billing
- Daily cash close
- Payroll entry
- Sales dashboard
- Top products
- Peak hours
- Customer LTV
- Conversion funnel
- Geo heatmap
- UPI payment
- Partial payment
- Split bill
- Payout to seller
- Payment failure

### 6. 🌐 The Site Builder Agent (Storefront CMS)

_Responsible for generating UI layout data and SEO._

- Store page
- Section / category
- Page / landing page
- Banner / hero
- Menu / navigation
- SEO metadata
- Multi-store chain

### How they work together (Example):

If a user texts the app: _"Book a tutor for tomorrow and use my loyalty points."_

1. The **Manager Agent** handles the schedule, blocking the `mass` time slot and creating the Booking `motion`.
2. The **Growth Agent** handles deducting the Loyalty Points.
3. The **Finance Agent** handles generating the remaining Invoice.
