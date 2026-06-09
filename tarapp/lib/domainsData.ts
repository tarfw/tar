export interface MatterRow {
  id: string;
  code: string;
  type: string;
  scope: string;
  owner: string;
  title: string;
  public: string;
  data: string;
  time: string;
}

export interface MassRow {
  id: string;
  matter: string;
  type: string;
  scope: string;
  qty: string | null;
  value: string;
  active: string;
  variant: string | null;
  mark: string;
  time: string;
  geo?: string;
}

export interface MotionRow {
  stream: string;
  seq: string;
  action: string;
  phase: string | null;
  delta: string;
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
  image: any; // e.g. require(...) or null
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
  matter: MatterRow[];
  mass: MassRow[];
  motion: MotionRow[];
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
    matter: [
      { id: "pizza", code: "PIZZA01", type: "product", scope: "g", owner: "pizzacompany", title: "Pepperoni Pizza", public: "1", data: '{"cat":"food","p":"12.00","o":{"s":["Small","Medium","Large"]}}', time: "1780833600" },
      { id: "extracheese", code: "MODCHEESE", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Cheese", public: "1", data: '{"mod":1}', time: "1780833600" },
      { id: "pepperoni", code: "MODPEPPERONI", type: "product", scope: "g", owner: "pizzacompany", title: "Extra Pepperoni", public: "1", data: '{"mod":1}', time: "1780833600" },
      { id: "store102", code: "TAMILPIZZA", type: "profile", scope: "g", owner: "pizzacompany", title: "Tamil Pizza Shop", public: "1", data: '{"cat":"restaurant","cur":"INR"}', time: "1780833600" }
    ],
    mass: [
      { id: "pizza0", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "10.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "pizza1", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "12.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
      { id: "pizza2", matter: "pizza", type: "1", scope: "s:102", qty: "50", value: "15.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
      { id: "pricecheese", matter: "extracheese", type: "1", scope: "s:102", qty: null, value: "1.50", active: "1", variant: null, mark: "0", time: "1780833600" },
      { id: "pricepepperoni", matter: "pepperoni", type: "1", scope: "s:102", qty: null, value: "2.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motion: [
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
    matter: [
      { id: "sneakers", code: "SNEAKERS01", type: "product", scope: "g", owner: "sneakercompany", title: "Everyday Sneakers", public: "1", data: '{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}', time: "1780833600" },
      { id: "store101", code: "TAMILSHOES", type: "profile", scope: "g", owner: "sneakercompany", title: "Tamil Shoes Store", public: "1", data: '{"cat":"store","cur":"INR"}', time: "1780833600" }
    ],
    mass: [
      { id: "sneakers0", matter: "sneakers", type: "1", scope: "s:101", qty: "10", value: "89.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "sneakers1", matter: "sneakers", type: "1", scope: "s:101", qty: "5", value: "89.00", active: "1", variant: "1", mark: "0", time: "1780833600" },
      { id: "sneakers2", matter: "sneakers", type: "1", scope: "s:101", qty: "8", value: "95.00", active: "1", variant: "2", mark: "0", time: "1780833600" },
      { id: "sneakers3", matter: "sneakers", type: "1", scope: "s:101", qty: "0", value: "95.00", active: "1", variant: "3", mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "sneakers0", seq: "1780833900000001", action: "101", phase: null, delta: "-1.0", data: null },
      { stream: "sneakers0", seq: "1780834800000001", action: "105", phase: "109", delta: "1.0", data: '{"co":"web","ph":{"109":1780835100},"carrier":"express"}' },
      { stream: "sneakers0", seq: "1780835400000001", action: "110", phase: null, delta: "89.00", data: '{"tax":12.00}' },
      { stream: "sneakers0", seq: "1780835700000001", action: "111", phase: null, delta: "-1.0", data: '{"r":"return"}' },
      { stream: "sneakers0", seq: "1780836000000001", action: "201", phase: null, delta: "89.00", data: '{"pay":"cash"}' },
      { stream: "sneakers0", seq: "1780836300000001", action: "405", phase: null, delta: "-5.0", data: '{"dest":"warehouse2"}' },
      { stream: "sneakers0", seq: "1780836600000001", action: "406", phase: null, delta: "10.0", data: '{"src":"warehouse1"}' },
      { stream: "sneakers0", seq: "1780836900000001", action: "801", phase: "802", delta: "89.00", data: '{"m":"stripe","ref":"ref123","ph":{"802":1780836960}}' },
      // Local private
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
    matter: [
      { id: "prod_thermos_99", code: "THERMOS01", type: "product", scope: "s:101", owner: "gear_co", title: "Titanium Travel Thermos", public: "1", data: '{"price":45.00,"category":"gear","sizes":["S","M","L"]}', time: "1780833600" },
      { id: "coupon_save50", code: "SAVE50", type: "coupon", scope: "s:101", owner: "marketing_admin", title: "50% Off Flash Coupon", public: "1", data: '{"discount":0.50}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_stock_thermos", matter: "prod_thermos_99", type: "stock", scope: "s:101", qty: "42", value: "45.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "mas_cart_user1", matter: "prod_thermos_99", type: "cart", scope: "p", qty: "1", value: "45.00", active: "1", variant: "0", mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_stock_thermos", seq: "1780833900000001", action: "101", phase: null, delta: "-1.0", data: '{"channel":"online"}' },
      { stream: "mas_cart_user1", seq: "1780834200000001", action: "102", phase: null, delta: "1.0", data: null, isLocal: true, time: "1780834200" },
      { stream: "mas_cart_user1", seq: "1780834500000001", action: "104", phase: "105", delta: "0.0", data: '{"ph":{"105":1780834560},"step":"billing"}' }
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
    matter: [
      { id: "dish_biryani", code: "BIRYANI", type: "product", scope: "s:102", owner: "pizzacompany", title: "Hyderabadi Chicken Biryani", public: "1", data: '{"price":12.00,"spicy":"high"}', time: "1780833600" },
      { id: "pos_terminal_1", code: "TILL_01", type: "profile", scope: "s:102", owner: "pizzacompany", title: "Front Counter Register", public: "1", data: '{"till_limit":500}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_stock_biryani", matter: "dish_biryani", type: "stock", scope: "s:102", qty: "25", value: "12.00", active: "1", variant: "0", mark: "0", time: "1780833600" },
      { id: "mas_table_4", matter: "dish_biryani", type: "slot", scope: "s:102", qty: "4", value: "0.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_table_4", seq: "1780833900000002", action: "206", phase: "207", delta: "1.0", data: '{"ph":{"207":1780834100},"kds":"kitchen_kds_01"}' },
      { stream: "pos_terminal_1", seq: "1780834200000002", action: "202", phase: null, delta: "100.0", data: '{"session":"shift_am"}' },
      { stream: "mas_table_4", seq: "1780834500000002", action: "201", phase: null, delta: "12.00", data: '{"pay":"cash"}' }
    ]
  },


  {
    id: "marketing",
    name: "Marketing & Forms",
    scopePrefix: "m:{id}",
    scopeClass: "Campaign / Forms",
    opcodes: "601 - 604",
    color: "#06b6d4",
    pastelBg: "#cffafe",
    emoji: "📣",
    description: "Dynamic checklist compilation, newsletter push notifications, signup validation, and feedback collection.",
    title: "Customer Feedback Form",
    code: "SURVEY_FEEDBACK",
    owner: "marketing_ops",
    priceRange: "Survey Active",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@survey_feedback" },
      { key: "ASIN / Blueprint ID", val: "@form_survey_01" },
      { key: "Category", val: "Forms / Marketing" },
      { key: "Owner", val: "marketing_ops" },
      { key: "Scope / Region", val: "Forms (m:101)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Dynamically compiled feedback form with custom survey fields.",
      "Offline responses saved locally and auto-synced upon network reconnection.",
      "Linked to customer relations lists to measure Net Promoter Scores."
    ],
    profileTitle: "Marketing Operations Unit",
    profileCode: "MKT_OPS",
    profileAvatarText: "MO",
    profileAvatarBg: "#155e75",
    profileBadgeText: "PUBLIC FORM",
    matter: [
      { id: "form_survey_01", code: "SURVEY_FEEDBACK", type: "form", scope: "m:101", owner: "marketing_ops", title: "Customer Feedback Form", public: "1", data: '{"fields":["rating","comments"],"target":"pos_sales"}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_form_run_01", matter: "form_survey_01", type: "form_task", scope: "m:101", qty: "1", value: "0.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_form_run_01", seq: "1780833900000006", action: "601", phase: null, delta: "1.0", data: '{"channel":"push_android"}' },
      { stream: "mas_form_run_01", seq: "1780834200000006", action: "604", phase: null, delta: "1.0", data: '{"rating":5,"comment":"Amazing checkout experience!"}' }
    ]
  },
  {
    id: "bookings",
    name: "Services & Bookings",
    scopePrefix: "f:{id}",
    scopeClass: "Family / Friends",
    opcodes: "701 - 703",
    color: "#14b8a6",
    pastelBg: "#ccfbf1",
    emoji: "📅",
    description: "Service catalog definitions, technician booking schedules, and appointment reservation tracking.",
    title: "Premium Haircut & Styling",
    code: "HAIRCUT",
    owner: "salon_mgr",
    priceRange: "$35.00",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@haircut" },
      { key: "ASIN / Blueprint ID", val: "@service_haircut" },
      { key: "Category", val: "Salon Services" },
      { key: "Owner", val: "salon_mgr" },
      { key: "Scope / Region", val: "Friend Circle (f:101)" },
      { key: "Visibility", val: "Public Shared (1)" }
    ],
    bullets: [
      "Premium service catalog booking with automated technician scheduling.",
      "Calendar availability slot booking mapped directly to employee rosters.",
      "Relates reservation slots to VIP client accounts and service providers."
    ],
    profileTitle: "Salon Coordinator Hub",
    profileCode: "SALON_MGR",
    profileAvatarText: "SC",
    profileAvatarBg: "#0f766e",
    profileBadgeText: "APPOINTMENT",
    matter: [
      { id: "service_haircut", code: "HAIRCUT", type: "service", scope: "f:101", owner: "salon_mgr", title: "Premium Haircut & Styling", public: "1", data: '{"duration_minutes":45,"allow_modifiers":true}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_slot_booking", matter: "service_haircut", type: "slot", scope: "f:101", qty: "1", value: "35.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_slot_booking", seq: "1780833900000007", action: "701", phase: "702", delta: "1.0", data: '{"ph":{"702":1780834500},"customer":"usr_googleid"}' }
    ]
  },
  {
    id: "payments",
    name: "Payments & Finance",
    scopePrefix: "p",
    scopeClass: "Personal",
    opcodes: "801 - 806",
    color: "#22c55e",
    pastelBg: "#dcfce7",
    emoji: "💵",
    description: "Gateway transaction ledgers, currency split auditing, budgets, and operational business expense tracking.",
    title: "State GST 9% Account",
    code: "SGST_9",
    owner: "finance_ops",
    priceRange: "$1000.00 Budget",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@sgst_9" },
      { key: "ASIN / Blueprint ID", val: "@tax_acct_sgst" },
      { key: "Category", val: "Tax / Accounting" },
      { key: "Owner", val: "finance_ops" },
      { key: "Scope / Region", val: "Personal (p)" },
      { key: "Visibility", val: "Private Shared (1)" }
    ],
    bullets: [
      "Automated tax calculation and transaction auditing for merchant payouts.",
      "Scoped ledger expense tracking with dynamic budget threshold alerts.",
      "Connects ledger entries to matching payment invoices for tax reconciliation."
    ],
    profileTitle: "Finance Operations Unit",
    profileCode: "FIN_OPS",
    profileAvatarText: "FO",
    profileAvatarBg: "#166534",
    profileBadgeText: "LEDGER AUDIT",
    matter: [
      { id: "tax_acct_sgst", code: "SGST_9", type: "tax", scope: "p", owner: "finance_ops", title: "State GST 9% Account", public: "1", data: '{"rate":0.09,"country":"IN"}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_budget_supplies", matter: "tax_acct_sgst", type: "budget", scope: "p", qty: "1000", value: "1000.00", active: "1", variant: null, mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_budget_supplies", seq: "1780833900000008", action: "801", phase: "802", delta: "120.00", data: '{"ph":{"802":1780833960},"gateway":"stripe"}' },
      { stream: "mas_budget_supplies", seq: "1780834200000008", action: "806", phase: null, delta: "-340.00", data: '{"desc":"Office supplies purchase"}' }
    ]
  },
  {
    id: "erp",
    name: "ERP, Sourcing & Fleet",
    scopePrefix: "x:{id}",
    scopeClass: "Surveys / ERP",
    opcodes: "901 - 907",
    color: "#f97316",
    pastelBg: "#ffedd5",
    emoji: "🏢",
    description: "Fleet machinery rosters, lease schedules, procurement sourcing requests, and recruitment workflows.",
    title: "Toyota Prius Fleet #01",
    code: "TAXI_KA01",
    owner: "fleet_admin",
    priceRange: "Fleet Active",
    image: null,
    technicalDetails: [
      { key: "Item Model Number", val: "@taxi_ka01" },
      { key: "ASIN / Blueprint ID", val: "@fleet_taxi_01" },
      { key: "Category", val: "Fleet Operations" },
      { key: "Owner", val: "fleet_admin" },
      { key: "Scope / Region", val: "ERP Fleet (x:erp)" },
      { key: "Visibility", val: "Internal Shared (1)" }
    ],
    bullets: [
      "Fleet operations monitoring vehicle health and fuel efficiency.",
      "Ride-hailing dispatch workflow tracking active trip hex coordinates.",
      "Procures maintenance parts catalog items linked directly to vendor profiles."
    ],
    profileTitle: "Enterprise Fleet Admin",
    profileCode: "FLEET_DEPT",
    profileAvatarText: "FA",
    profileAvatarBg: "#c2410c",
    profileBadgeText: "FLEET DISPATCH",
    matter: [
      { id: "fleet_taxi_01", code: "TAXI_KA01", type: "vehicle", scope: "x:erp", owner: "fleet_admin", title: "Toyota Prius Fleet #01", public: "1", data: '{"fuel_type":"hybrid","status":"active"}', time: "1780833600" }
    ],
    mass: [
      { id: "mas_trip_taxi", matter: "fleet_taxi_01", type: "trip", scope: "x:erp", qty: "1", value: "0.00", active: "1", variant: null, geo: "833075fffffffff", mark: "0", time: "1780833600" }
    ],
    motion: [
      { stream: "mas_trip_taxi", seq: "1780833900000009", action: "903", phase: "905", delta: "1.0", data: '{"ph":{"904":1780834000,"905":1780834200},"origin":"terminal_t3"}' },
      { stream: "fleet_taxi_01", seq: "1780834200000009", action: "907", phase: null, delta: "1200.00", data: '{"part":"battery_pack","reason":"aging"}' }
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
  604: "FORM SUBMIT",
  701: "BOOKED",
  702: "COMPLETED",
  801: "PAYMENT INIT",
  802: "PAYMENT SUCCESS",
  805: "PAYMENT FAIL",
  806: "EXPENSE REC",
  903: "RIDE REQ",
  905: "IN RIDE",
  907: "PROCURE REQ"
};
