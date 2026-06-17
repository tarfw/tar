export interface FormRow {
  id: string;
  code: string;
  type: string;
  scope: string;
  owner: string;
  title: string;
  public: string;
  active: string;
  data: string;
  time: string;
}

export interface MatterRow {
  id: string;
  form: string;
  type: string;
  scope: string;
  qty: string | null;
  value: string;
  active: string;
  variant: string | null;
  mark: string;
  time: string;
  geo?: string;
  start?: string;
  end?: string;
}

export interface MotionRow {
  stream: string;
  seq: string;
  action: string;
  phase: string | null;
  delta: string;
  client_ref?: string | null;
  data: string | null;
  isLocal?: boolean;
  time?: string;
}

export interface TechnicalDetail {
  key: string;
  val: string;
}

export interface DomainDefinition {
  id: string;
  name: string;
  scopePrefix: string;
  scopeClass: string;
  opcodes: string;
  color: string;
  pastelBg: string;
  emoji: string;
  description: string;
  // Product details
  title: string;
  code: string;
  owner: string;
  priceRange: string;
  image: any;
  // Specs Accordion
  technicalDetails: TechnicalDetail[];
  bullets: string[];
  // Store / Profile
  profileTitle: string;
  profileCode: string;
  profileAvatarText: string;
  profileAvatarBg: string;
  profileBadgeText: string;
  // Tables data
  forms: FormRow[];
  matters: MatterRow[];
  motions: MotionRow[];
}

export const DOMAINS: DomainDefinition[] = [
  {
    id: "pizza",
    name: "Pizza (Original)",
    scopePrefix: "g",
    scopeClass: "Global",
    opcodes: "101 - 802",
    color: "#e11d48",
    pastelBg: "#ffe4e6",
    emoji: "🍕",
    description: "Original Pepperoni Pizza order customization, modifier mapping, and real-time kitchen preparation queue.",
    title: "Pepperoni Pizza",
    code: "PIZZA01",
    owner: "pizzacompany",
    priceRange: "$10.00 - $15.00",
    image: require("../assets/images/pizza_storefront.jpg"),
    technicalDetails: [
      { key: "Item Model Number", val: "@pizza01" },
      { key: "ASIN / Blueprint ID", val: "@pizza" },
      { key: "Category", val: "Hot Food / Pizza" },
      { key: "Manufacturer", val: "pizzacompany" },
      { key: "Scope / Region", val: "Global (g)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Freshly baked stone-oven crust topped with signature marinara, mozzarella cheese, and spicy beef pepperoni.",
      "Customize instantly with modifier blueprints like extra cheese and extra pepperoni to suit your taste.",
      "Fired directly to kitchen display systems and tracked using POS-native status update motion ledgers."
    ],
    profileTitle: "Tamil Pizza Shop",
    profileCode: "TAMILPIZZA",
    profileAvatarText: "TP",
    profileAvatarBg: "#881337",
    profileBadgeText: "KDS SCREEN",
    forms: [
      { id: "pizza", code: "PIZZA01", type: "product", scope: "g", owner: "pizzacompany", title: "Pepperoni Pizza", public: "1", active: "1", data: '{"cat":"food","p":"12.00","o":{"s":["Small","Medium","Large"]}}', time: "1780833600" },
      { id: "extracheese", code: "MODCHEESE", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Cheese", public: "1", active: "1", data: '{"mod":1}', time: "1780833600" },
      { id: "pepperoni", code: "MODPEPPERONI", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Pepperoni", public: "1", active: "1", data: '{"mod":1}', time: "1780833600" },
      { id: "store102", code: "TAMILPIZZA", type: "profile", scope: "g", owner: "pizzacompany", title: "Tamil Pizza Shop", public: "1", active: "1", data: '{"cat":"restaurant","cur":"INR"}', time: "1780833600" }
    ],
    matters: [
      { id: "pizza0", form: "pizza", type: "1", scope: "s:102", qty: "50", value: "10.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "pizza1", form: "pizza", type: "1", scope: "s:102", qty: "50", value: "12.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
      { id: "pizza2", form: "pizza", type: "1", scope: "s:102", qty: "50", value: "15.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
      { id: "pricecheese", form: "extracheese", type: "1", scope: "s:102", qty: null, value: "1.50", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "pricepepperoni", form: "pepperoni", type: "1", scope: "s:102", qty: null, value: "2.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "pizza0", seq: "1780833900000002", action: "101", phase: null, delta: "-1.0", data: null },
      { stream: "pizza0", seq: "1780834200000002", action: "105", phase: "109", delta: "1.0", data: '{"ph":{"106":1780834320,"107":1780834500,"206":1780834560,"207":1780834800,"108":1780834920,"109":1780835100},"staff":"mgr01","kds":"kds1"}' },
      { stream: "pizza0", seq: "1780835400000002", action: "201", phase: null, delta: "10.00", data: '{"till":"till1"}' },
      { stream: "pizza0", seq: "1780835460000002", action: "801", phase: "802", delta: "10.00", data: '{"m":"card","ref":"tx992","ph":{"802":1780835520}}' }
    ]
  },
  {
    id: "sneakers",
    name: "Sneakers (Original)",
    scopePrefix: "g",
    scopeClass: "Global",
    opcodes: "101 - 801",
    color: "#2563eb",
    pastelBg: "#dbeafe",
    emoji: "👟",
    description: "Original Everyday Sneakers item storefront, stock adjustments, and multi-channel checkout sales records.",
    title: "Everyday Sneakers",
    code: "SNEAKERS01",
    owner: "sneakercompany",
    priceRange: "$89.00 - $95.00",
    image: require("../assets/images/sneaker_storefront.png"),
    technicalDetails: [
      { key: "Item Model Number", val: "@sneakers01" },
      { key: "ASIN / Blueprint ID", val: "@sneakers" },
      { key: "Department", val: "Unisex-Adult" },
      { key: "Manufacturer", val: "sneakercompany" },
      { key: "Scope / Region", val: "Global (g)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Premium canvas & athletic mesh upper providing breathable comfort all day long.",
      "Dynamic configuration capabilities supporting real-time option switching for color and size.",
      "Full local replication ledgers synchronized via TAMILSHOES regional store profile databases."
    ],
    profileTitle: "Tamil Shoes Store",
    profileCode: "TAMILSHOES",
    profileAvatarText: "TS",
    profileAvatarBg: "#1e293b",
    profileBadgeText: "INR STORE",
    forms: [
      { id: "sneakers", code: "SNEAKERS01", type: "product", scope: "g", owner: "sneakercompany", title: "Everyday Sneakers", public: "1", active: "1", data: '{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}', time: "1780833600" },
      { id: "store101", code: "TAMILSHOES", type: "profile", scope: "g", owner: "sneakercompany", title: "Tamil Shoes Store", public: "1", active: "1", data: '{"cat":"store","cur":"INR"}', time: "1780833600" }
    ],
    matters: [
      { id: "sneakers0", form: "sneakers", type: "1", scope: "s:101", qty: "10", value: "89.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "sneakers1", form: "sneakers", type: "1", scope: "s:101", qty: "5", value: "89.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
      { id: "sneakers2", form: "sneakers", type: "1", scope: "s:101", qty: "8", value: "95.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
      { id: "sneakers3", form: "sneakers", type: "1", scope: "s:101", qty: "0", value: "95.00", active: "1", variant: "3", mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "sneakers0", seq: "1780833900000001", action: "101", phase: null, delta: "-1.0", data: null },
      { stream: "sneakers0", seq: "1780834800000001", action: "105", phase: "109", delta: "1.0", data: '{"co":"web","ph":{"109":1780835100},"carrier":"express"}' },
      { stream: "sneakers0", seq: "1780835400000001", action: "110", phase: null, delta: "89.00", data: '{"tax":12.00}' },
      { stream: "sneakers0", seq: "1780835700000001", action: "111", phase: null, delta: "-1.0", data: '{"r":"return"}' },
      { stream: "sneakers0", seq: "1780836000000001", action: "201", phase: null, delta: "89.00", data: '{"pay":"cash"}' },
      { stream: "sneakers0", seq: "1780836300000001", action: "405", phase: null, delta: "-5.0", data: '{"dest":"warehouse2"}' },
      { stream: "sneakers0", seq: "1780836600000001", action: "406", phase: null, delta: "10.0", data: '{"src":"warehouse1"}' },
      { stream: "sneakers0", seq: "1780836900000001", action: "801", phase: "802", delta: "89.00", data: '{"m":"stripe","ref":"ref123","ph":{"802":1780836960}}' },
      { stream: "sneakers0", seq: "1", action: "102", phase: null, delta: "1.0", data: null, isLocal: true, time: "1780834200" },
      { stream: "sneakers0", seq: "2", action: "103", phase: null, delta: "-1.0", data: null, isLocal: true, time: "1780834500" },
      { stream: "sneakers0", seq: "3", action: "104", phase: null, delta: "0.0", data: '{"step":"billing"}', isLocal: true, time: "1780834560" }
    ]
  },
  {
    id: "retail",
    name: "Retail & E-Commerce",
    scopePrefix: "s:{id}",
    scopeClass: "Storefront",
    opcodes: "101 - 114",
    color: "#10b981",
    pastelBg: "#d1fae5",
    emoji: "🛒",
    description: "Handles customer storefront catalog, order pipeline, checkout baskets, and invoicing.",
    title: "Titanium Travel Thermos",
    code: "THERMOS01",
    owner: "gear_co",
    priceRange: "$45.00",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@thermos01" },
      { key: "ASIN / Blueprint ID", val: "@prod_thermos_99" },
      { key: "Category", val: "Outdoor Gear / Bottles" },
      { key: "Manufacturer", val: "gear_co" },
      { key: "Scope / Region", val: "Storefront (s:101)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12 hours.",
      "High-grade titanium construction provides maximum strength at minimal weight.",
      "Scoped to specific storefront local database replica nodes for fast offline reads."
    ],
    profileTitle: "Gear Co. Storefront",
    profileCode: "GEAR_ST101",
    profileAvatarText: "GC",
    profileAvatarBg: "#065f46",
    profileBadgeText: "RETAIL STORE",
    forms: [
      { id: "prod_thermos_99", code: "THERMOS01", type: "product", scope: "s:101", owner: "gear_co", title: "Titanium Travel Thermos", public: "1", active: "1", data: '{"price":45.00,"category":"gear","sizes":["S","M","L"]}', time: "1780833600" },
      { id: "coupon_save50", code: "SAVE50", type: "coupon", scope: "s:101", owner: "marketing_admin", title: "50% Off Flash Coupon", public: "1", active: "1", data: '{"discount":0.50}', time: "1780833600" }
    ],
    matters: [
      { id: "matter_stock_thermos", form: "prod_thermos_99", type: "stock", scope: "s:101", qty: "42", value: "45.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "matter_cart_user1", form: "prod_thermos_99", type: "cart", scope: "p", qty: "1", value: "45.00", active: "1", variant: "0", mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "matter_stock_thermos", seq: "1780833900000001", action: "101", phase: null, delta: "-1.0", data: '{"channel":"online"}' },
      { stream: "matter_cart_user1", seq: "1780834200000001", action: "102", phase: null, delta: "1.0", data: null, isLocal: true, time: "1780834200" },
      { stream: "matter_cart_user1", seq: "1780834500000001", action: "104", phase: "105", delta: "0.0", data: '{"ph":{"105":1780834560},"step":"billing"}' }
    ]
  },
  {
    id: "pos",
    name: "POS & Restaurant",
    scopePrefix: "s:{id}",
    scopeClass: "Storefront",
    opcodes: "201 - 210",
    color: "#f59e0b",
    pastelBg: "#fef3c7",
    emoji: "🍗",
    description: "Menu ordering, table management, live kitchen KDS display queue, and terminal till reconciliation.",
    title: "Hyderabadi Chicken Biryani",
    code: "BIRYANI",
    owner: "pizzacompany",
    priceRange: "$12.00",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@biryani" },
      { key: "ASIN / Blueprint ID", val: "@dish_biryani" },
      { key: "Category", val: "Main Course" },
      { key: "Manufacturer", val: "pizzacompany" },
      { key: "Scope / Region", val: "Storefront (s:102)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Fragrant long-grain basmati rice layered with spiced chicken, saffron, and fresh herbs.",
      "Traditional slow-cooked Dum method seals in rich flavors and aromas.",
      "Instantly dispatches to Kitchen Display Systems using standard POS opcode commands."
    ],
    profileTitle: "Front Counter Till #01",
    profileCode: "TILL_01",
    profileAvatarText: "FC",
    profileAvatarBg: "#78350f",
    profileBadgeText: "POS REGISTER",
    forms: [
      { id: "dish_biryani", code: "BIRYANI", type: "product", scope: "s:102", owner: "pizzacompany", title: "Hyderabadi Chicken Biryani", public: "1", active: "1", data: '{"price":12.00,"spicy":"high"}', time: "1780833600" },
      { id: "pos_terminal_1", code: "TILL_01", type: "profile", scope: "s:102", owner: "pizzacompany", title: "Front Counter Register", public: "1", active: "1", data: '{"till_limit":500}', time: "1780833600" }
    ],
    matters: [
      { id: "matter_stock_biryani", form: "dish_biryani", type: "stock", scope: "s:102", qty: "25", value: "12.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "matter_table_4", form: "dish_biryani", type: "slot", scope: "s:102", qty: "4", value: "0.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "matter_table_4", seq: "1780833900000002", action: "206", phase: "207", delta: "1.0", data: '{"ph":{"207":1780834100},"kds":"kitchen_kds_01"}' },
      { stream: "pos_terminal_1", seq: "1780834200000002", action: "202", phase: null, delta: "100.0", data: '{"session":"shift_am"}' },
      { stream: "matter_table_4", seq: "1780834500000002", action: "201", phase: null, delta: "12.00", data: '{"pay":"cash"}' }
    ]
  },
  {
    id: "marketing",
    name: "Marketing Campaigns",
    scopePrefix: "g",
    scopeClass: "Global",
    opcodes: "601 - 604",
    color: "#8b5cf6",
    pastelBg: "#ede9fe",
    emoji: "📢",
    description: "Push notification campaigns, SMS blasts, referral programs, and web form submissions.",
    title: "Summer Sale Push Campaign",
    code: "CAMP_SUMMER",
    owner: "marketing_admin",
    priceRange: "N/A",
    image: null,
    technicalDetails: [
      { key: "Campaign ID", val: "@camp_summer" },
      { key: "Type", val: "Push Notification" },
      { key: "Target", val: "All active users" },
      { key: "Channel", val: "Push + SMS" },
      { key: "Scope / Region", val: "Global (g)" },
      { key: "Status", val: "Active" }
    ],
    bullets: [
      "Multi-channel campaign delivery via push notifications and SMS text messages.",
      "Referral program tracking with unique referral codes and reward distribution.",
      "Web form submissions captured and routed to CRM lead pipelines automatically."
    ],
    profileTitle: "Marketing Dashboard",
    profileCode: "MKTG_DASH",
    profileAvatarText: "MD",
    profileAvatarBg: "#5b21b6",
    profileBadgeText: "CAMPAIGN MGR",
    forms: [
      { id: "camp_summer", code: "CAMP_SUMMER", type: "campaign", scope: "g", owner: "marketing_admin", title: "Summer Sale Push", public: "1", active: "1", data: '{"channel":"push","audience":"all","budget":5000}', time: "1780833600" },
      { id: "sms_blast", code: "SMS_BLAST", type: "campaign", scope: "g", owner: "marketing_admin", title: "SMS Flash Sale", public: "1", active: "1", data: '{"channel":"sms","audience":"vip","budget":2000}', time: "1780833600" },
      { id: "referral_prog", code: "REFERRAL", type: "campaign", scope: "g", owner: "marketing_admin", title: "Refer a Friend", public: "1", active: "1", data: '{"reward":10,"type":"credits"}', time: "1780833600" },
      { id: "web_form_1", code: "WEBFORM_1", type: "form", scope: "g", owner: "marketing_admin", title: "Contact Us Form", public: "1", active: "1", data: '{"fields":["name","email","phone","message"]}', time: "1780833600" }
    ],
    matters: [
      { id: "push_sent_001", form: "camp_summer", type: "push", scope: "g", qty: "15000", value: "0", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "sms_sent_001", form: "sms_blast", type: "sms", scope: "g", qty: "3000", value: "0", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "referral_001", form: "referral_prog", type: "referral", scope: "g", qty: "250", value: "10.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "push_sent_001", seq: "1780833900000001", action: "601", phase: null, delta: "15000.0", data: '{"title":"Summer Sale!","body":"50% off everything"}' },
      { stream: "sms_sent_001", seq: "1780834200000001", action: "602", phase: null, delta: "3000.0", data: '{"template":"flash_sale","char_count":160}' },
      { stream: "referral_001", seq: "1780834500000001", action: "603", phase: null, delta: "250.0", data: '{"referred_by":"usr_abc","reward":"credits"}' },
      { stream: "web_form_1", seq: "1780834800000001", action: "604", phase: null, delta: "1.0", data: '{"name":"John","email":"john@example.com","source":"website"}' }
    ]
  },
  {
    id: "services",
    name: "Services & Booking",
    scopePrefix: "s:{id}",
    scopeClass: "Storefront",
    opcodes: "701 - 703",
    color: "#0891b2",
    pastelBg: "#cffafe",
    emoji: "🏠",
    description: "Service scheduling, time slot booking, appointment management, and cancellation handling.",
    title: "Plumbing Service - 2hr Slot",
    code: "SVC_PLUMB",
    owner: "home_services",
    priceRange: "$75.00 - $150.00",
    image: null,
    technicalDetails: [
      { key: "Service ID", val: "@svc_plumb" },
      { key: "Category", val: "Home Maintenance" },
      { key: "Duration", val: "2 hours" },
      { key: "Provider", val: "home_services" },
      { key: "Scope / Region", val: "Storefront (s:201)" },
      { key: "Availability", val: "Mon-Sat 8AM-6PM" }
    ],
    bullets: [
      "Professional plumbing service with certified technicians and guaranteed workmanship.",
      "Flexible time slot booking with real-time availability and instant confirmation.",
      "Full lifecycle tracking from booking to completion with cancellation support."
    ],
    profileTitle: "Home Services Co.",
    profileCode: "HOMESVC",
    profileAvatarText: "HS",
    profileAvatarBg: "#164e63",
    profileBadgeText: "SERVICE BOOK",
    forms: [
      { id: "svc_plumb", code: "SVC_PLUMB", type: "service", scope: "s:201", owner: "home_services", title: "Plumbing Service", public: "1", active: "1", data: '{"duration":120,"price":75,"category":"plumbing"}', time: "1780833600" },
      { id: "svc_elec", code: "SVC_ELEC", type: "service", scope: "s:201", owner: "home_services", title: "Electrical Service", public: "1", active: "1", data: '{"duration":90,"price":90,"category":"electrical"}', time: "1780833600" },
      { id: "slot_morning", code: "SLOT_AM", type: "slot", scope: "s:201", owner: "home_services", title: "Morning Slot 8-10AM", public: "1", active: "1", data: '{"start":"08:00","end":"10:00","capacity":3}', time: "1780833600" },
      { id: "profile_svc", code: "HOMESVC", type: "profile", scope: "s:201", owner: "home_services", title: "Home Services Co.", public: "1", active: "1", data: '{"cat":"services","rating":4.8}', time: "1780833600" }
    ],
    matters: [
      { id: "booking_001", form: "svc_plumb", type: "booking", scope: "s:201", qty: "1", value: "75.00", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "booking_002", form: "svc_elec", type: "booking", scope: "s:201", qty: "1", value: "90.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "booking_001", seq: "1780833900000001", action: "701", phase: null, delta: "75.0", data: '{"slot":"2024-07-15T08:00","customer":"usr_123","address":"123 Main St"}' },
      { stream: "booking_001", seq: "1780834500000001", action: "702", phase: null, delta: "0.0", data: '{"completed_by":"tech_01","notes":"Pipe replaced"}' },
      { stream: "booking_002", seq: "1780834800000001", action: "701", phase: null, delta: "90.0", data: '{"slot":"2024-07-16T14:00","customer":"usr_456"}' },
      { stream: "booking_002", seq: "1780835100000001", action: "703", phase: null, delta: "0.0", data: '{"reason":"Rescheduled","refund":true}' }
    ]
  },
  {
    id: "taxi",
    name: "Taxi & Ride Hailing",
    scopePrefix: "g",
    scopeClass: "Global",
    opcodes: "903 - 907",
    color: "#ea580c",
    pastelBg: "#fff7ed",
    emoji: "🚕",
    description: "Ride requests, driver matching, trip lifecycle, real-time ETA, and ride ratings.",
    title: "Airport Ride - Sedan",
    code: "RIDE_AIRPORT",
    owner: "taxi_fleet",
    priceRange: "$25.00 - $45.00",
    image: null,
    technicalDetails: [
      { key: "Ride ID", val: "@ride_airport" },
      { key: "Vehicle Type", val: "Sedan" },
      { key: "Distance", val: "12.5 km" },
      { key: "Fleet", val: "taxi_fleet" },
      { key: "Scope / Region", val: "Global (g)" },
      { key: "ETA", val: "8 minutes" }
    ],
    bullets: [
      "On-demand ride hailing with real-time driver matching using H3 hex grid location.",
      "Full trip lifecycle from request to drop-off with live ETA updates and fare tracking.",
      "Post-ride rating system with driver performance analytics and fleet management."
    ],
    profileTitle: "QuickRide Fleet",
    profileCode: "QR_FLEET",
    profileAvatarText: "QR",
    profileAvatarBg: "#9a3412",
    profileBadgeText: "RIDE OPS",
    forms: [
      { id: "ride_airport", code: "RIDE_AIRPORT", type: "ride", scope: "g", owner: "taxi_fleet", title: "Airport Sedan", public: "1", active: "1", data: '{"vehicle":"sedan","capacity":4,"luggage":2}', time: "1780833600" },
      { id: "driver_01", code: "DRV_01", type: "profile", scope: "g", owner: "taxi_fleet", title: "Driver Ravi", public: "1", active: "1", data: '{"rating":4.9,"trips":1250,"vehicle":"TN-01-AB-1234"}', time: "1780833600" },
      { id: "driver_02", code: "DRV_02", type: "profile", scope: "g", owner: "taxi_fleet", title: "Driver Kumar", public: "1", active: "1", data: '{"rating":4.7,"trips":890,"vehicle":"TN-02-CD-5678"}', time: "1780833600" }
    ],
    matters: [
      { id: "trip_001", form: "ride_airport", type: "trip", scope: "g", qty: "1", value: "35.00", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "trip_002", form: "ride_airport", type: "trip", scope: "g", qty: "1", value: "28.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motions: [
      { stream: "trip_001", seq: "1780833900000001", action: "903", phase: null, delta: "35.0", data: '{"pickup":"Airport Terminal 2","dropoff":"Hotel Taj","pax":2}' },
      { stream: "trip_001", seq: "1780834100000001", action: "904", phase: null, delta: "0.0", data: '{"driver":"drv_01","eta_min":8,"distance_km":12.5}' },
      { stream: "trip_001", seq: "1780834700000001", action: "905", phase: null, delta: "35.0", data: '{"started":"2024-07-15T10:30","route":"NH48"}' },
      { stream: "trip_001", seq: "1780835900000001", action: "801", phase: "802", delta: "35.0", data: '{"m":"upi","ref":"upi_tx_001","ph":{"802":1780835960}}' },
      { stream: "trip_002", seq: "1780834200000001", action: "903", phase: null, delta: "28.0", data: '{"pickup":"Mall Road","dropoff":"Station","pax":1}' },
      { stream: "trip_002", seq: "1780834400000001", action: "904", phase: null, delta: "0.0", data: '{"driver":"drv_02","eta_min":5,"distance_km":8.2}' },
      { stream: "trip_002", seq: "1780835000000001", action: "905", phase: null, delta: "28.0", data: '{"started":"2024-07-15T11:00"}' }
    ]
  }
];

export const OPCODE_LABELS: { [key: number]: string } = {
  101: "SOLD",
  102: "CART ADD",
  103: "CART REMOVE",
  104: "CHECKOUT",
  105: "PLACED",
  106: "CONFIRMED",
  107: "PREPARING",
  108: "READY",
  109: "DELIVERED",
  110: "INVOICE GEN",
  111: "REFUND",
  201: "SALE",
  202: "SHIFT START",
  206: "ORDER FIRE",
  207: "ITEM READY",
  301: "STORE VISIT",
  302: "REVIEW",
  303: "LEAD CREATE",
  304: "CONTACTED",
  305: "CONVERTED",
  306: "TICKET OPEN",
  307: "REPLY",
  308: "RESOLVED",
  309: "BIRTHDAY OFFER",
  401: "DISPATCHED",
  402: "IN TRANSIT",
  403: "DRIVER ASSIGNED",
  404: "ETA UPDATE",
  405: "TRANSFER OUT",
  406: "TRANSFER IN",
  407: "RETURN REQUEST",
  410: "DELIVERY ATTEMPT",
  501: "CLOCK IN",
  502: "CLOCK OUT",
  504: "TASK ASSIGNED",
  506: "LEAVE REQ",
  507: "APPROVED",
  601: "PUSH SENT",
  602: "SMS SENT",
  603: "REFERRAL",
  604: "FORM SUBMIT",
  701: "BOOKED",
  702: "COMPLETED",
  703: "CANCELLED",
  801: "PAYMENT INIT",
  802: "PAYMENT SUCCESS",
  805: "PAYMENT FAIL",
  806: "EXPENSE REC",
  903: "RIDE REQ",
  904: "DRIVER MATCH",
  905: "IN RIDE",
  906: "TRIP END",
  907: "PROCURE REQ"
};
