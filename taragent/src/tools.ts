// src/tools.ts — All tool definitions for Groq function-calling
// Tools are OpenAI-compatible JSON schema function definitions.
// They are filtered per group role by rbac.ts before being sent to the LLM.

import type { ChatCompletionTool } from "openai/resources/chat/completions";

// ─── Inventory Tools ───────────────────────────────────────────────────────────

const updateInventory: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_inventory",
    description: "Update the quantity of an inventory item in the database.",
    parameters: {
      type: "object",
      properties: {
        item: {
          type: "string",
          description: 'Name of the inventory item (e.g., "heavy cream")',
        },
        quantity: { type: "number", description: "New quantity amount" },
        unit: {
          type: "string",
          description:
            'Unit of measurement (e.g., "cartons", "bags", "litres")',
        },
      },
      required: ["item", "quantity"],
    },
  },
};

const logWaste: ChatCompletionTool = {
  type: "function",
  function: {
    name: "log_waste",
    description: "Log food/ingredient waste with a reason.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "Name of the item wasted" },
        quantity: { type: "number", description: "Quantity wasted" },
        reason: {
          type: "string",
          description: 'Reason for waste (e.g., "bruised", "expired")',
        },
        unit: { type: "string", description: "Unit of measurement" },
      },
      required: ["item", "quantity", "reason"],
    },
  },
};

const eightySixItem: ChatCompletionTool = {
  type: "function",
  function: {
    name: "86_item",
    description:
      "Mark a menu item as 86'd (out of stock) and remove it from active menus and POS.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "Name of the menu item to 86" },
        status: {
          type: "string",
          enum: ["86", "available"],
          description: "86 to remove, available to restore",
        },
      },
      required: ["item", "status"],
    },
  },
};

const createPurchaseOrder: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_purchase_order",
    description: "Generate a supplier purchase order for restocking inventory.",
    parameters: {
      type: "object",
      properties: {
        supplier: {
          type: "string",
          description: 'Name of the supplier (e.g., "Sysco")',
        },
        items: {
          type: "array",
          description: "List of items to order",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: "number" },
              unit: { type: "string" },
            },
            required: ["name", "qty"],
          },
        },
      },
      required: ["supplier", "items"],
    },
  },
};

// ─── Order / Delivery Tools ───────────────────────────────────────────────────

const createDeliveryOrder: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_delivery_order",
    description: "Create a new delivery order from a customer request.",
    parameters: {
      type: "object",
      properties: {
        customer_phone: {
          type: "string",
          description: "Customer phone number",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              size: { type: "string" },
              qty: { type: "number" },
            },
            required: ["name", "qty"],
          },
        },
        address: { type: "string", description: "Delivery address" },
        notes: { type: "string", description: "Special instructions" },
      },
      required: ["customer_phone", "items", "address"],
    },
  },
};

const updateDeliveryStatus: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_delivery_status",
    description: "Update the status of an active delivery or order.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID to update" },
        status: {
          type: "string",
          enum: [
            "placed",
            "accepted",
            "preparing",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ],
          description: "New order status",
        },
        notes: {
          type: "string",
          description: "Optional notes (e.g., driver location)",
        },
      },
      required: ["order_id", "status"],
    },
  },
};

const voidOrder: ChatCompletionTool = {
  type: "function",
  function: {
    name: "void_order",
    description: "Void or cancel an existing order and return items to stock.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "ID of the order to void" },
        reason: { type: "string", description: "Reason for voiding the order" },
      },
      required: ["order_id", "reason"],
    },
  },
};

// ─── Sales Tools ──────────────────────────────────────────────────────────────

const getSalesSummary: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_sales_summary",
    description: "Get a sales summary for a specific shift or time period.",
    parameters: {
      type: "object",
      properties: {
        shift: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner", "closing", "all_day"],
          description: "The shift to summarize",
        },
        date: {
          type: "string",
          description:
            'Date to query — use "today", "yesterday", or ISO date (YYYY-MM-DD)',
        },
      },
      required: ["shift", "date"],
    },
  },
};

const compareSales: ChatCompletionTool = {
  type: "function",
  function: {
    name: "compare_sales",
    description: "Compare sales performance between two time periods.",
    parameters: {
      type: "object",
      properties: {
        period1: {
          type: "string",
          description: 'First period (e.g., "this_week", "2026-02-01")',
        },
        period2: {
          type: "string",
          description: "Second period to compare against",
        },
      },
      required: ["period1", "period2"],
    },
  },
};

const updatePlatformStatus: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_platform_status",
    description:
      "Pause or resume a delivery platform (UberEats, DoorDash, etc.) for a specific brand.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description: 'Delivery platform name (e.g., "ubereats", "doordash")',
        },
        status: {
          type: "string",
          enum: ["active", "paused"],
          description: "New status",
        },
        brand: {
          type: "string",
          description: "Brand/restaurant name to update",
        },
        duration: {
          type: "string",
          description: 'Optional pause duration (e.g., "15m", "1h")',
        },
      },
      required: ["platform", "status"],
    },
  },
};

// ─── Staff Tools ──────────────────────────────────────────────────────────────

const addEmployee: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_employee",
    description: "Add a new employee to the payroll system.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name of the employee" },
        role: {
          type: "string",
          description: 'Job role (e.g., "line_cook", "bartender", "manager")',
        },
        hourly_rate: {
          type: "number",
          description: "Hourly wage in local currency",
        },
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD or natural language)",
        },
      },
      required: ["name", "role", "hourly_rate", "start_date"],
    },
  },
};

const requestTimeOff: ChatCompletionTool = {
  type: "function",
  function: {
    name: "request_time_off",
    description: "Submit a time-off request for an employee.",
    parameters: {
      type: "object",
      properties: {
        employee_id: {
          type: "string",
          description: "Employee ID (or name if ID unknown)",
        },
        date: {
          type: "string",
          description: "Requested day off (YYYY-MM-DD or natural language)",
        },
        reason: { type: "string", description: "Reason for time-off request" },
      },
      required: ["employee_id", "date", "reason"],
    },
  },
};

const getSchedule: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_schedule",
    description: "Get the schedule for a specific role, shift, or date.",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: 'Staff role to filter by (e.g., "bartender")',
        },
        shift: {
          type: "string",
          description: 'Shift to filter (e.g., "opening", "closing")',
        },
        date: {
          type: "string",
          description: 'Date to query (e.g., "today", "tonight", YYYY-MM-DD)',
        },
      },
      required: ["date"],
    },
  },
};

// ─── Maintenance Tools ────────────────────────────────────────────────────────

const createMaintenanceTicket: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_maintenance_ticket",
    description: "Create a maintenance or repair ticket for equipment.",
    parameters: {
      type: "object",
      properties: {
        equipment: {
          type: "string",
          description:
            'Equipment name or ID (e.g., "prep_fridge", "fryer_line_2")',
        },
        issue: { type: "string", description: "Description of the problem" },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Urgency level of the issue",
        },
        location: {
          type: "string",
          description: 'Location of the equipment (e.g., "back kitchen")',
        },
      },
      required: ["equipment", "issue", "urgency"],
    },
  },
};

const updateMaintenanceTicket: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_maintenance_ticket",
    description: "Update the status of an existing maintenance ticket.",
    parameters: {
      type: "object",
      properties: {
        ticket_id: { type: "string", description: "Maintenance ticket ID" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "resolved", "closed"],
          description: "New ticket status",
        },
        resolution_notes: {
          type: "string",
          description: "Notes about how the issue was resolved",
        },
      },
      required: ["ticket_id", "status"],
    },
  },
};

const getTaskStatus: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_task_status",
    description:
      "Get the completion status of a task checklist or daily operations checklist.",
    parameters: {
      type: "object",
      properties: {
        checklist_id: {
          type: "string",
          description: 'Checklist identifier (e.g., "daily_deep_clean")',
        },
        shift: {
          type: "string",
          description: 'Shift to check (e.g., "morning", "evening")',
        },
        date: { type: "string", description: "Date to check (default: today)" },
      },
      required: ["checklist_id"],
    },
  },
};

// ─── CRM / Reservations ──────────────────────────────────────────────────────

const updateReservationStatus: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_reservation_status",
    description:
      "Update the status of a customer reservation (e.g., seated, no-show).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Customer last name or reservation name",
        },
        status: {
          type: "string",
          enum: ["confirmed", "seated", "completed", "no_show", "cancelled"],
          description: "New reservation status",
        },
        table: {
          type: "string",
          description: "Table number assigned (optional)",
        },
        party_size: {
          type: "number",
          description: "Number of guests (optional)",
        },
      },
      required: ["name", "status"],
    },
  },
};

const getRecentReviews: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_recent_reviews",
    description: "Fetch recent customer reviews from online platforms.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            'Platform to search (e.g., "yelp", "google", "tripadvisor", "all")',
        },
        sentiment: {
          type: "string",
          enum: ["positive", "negative", "neutral", "all"],
          description: "Filter by sentiment",
        },
        time_range: {
          type: "string",
          description: 'Time range (e.g., "last_24_hours", "last_7_days")',
        },
      },
      required: ["platform"],
    },
  },
};

const draftReviewResponse: ChatCompletionTool = {
  type: "function",
  function: {
    name: "draft_review_response",
    description: "Draft a response to a customer review.",
    parameters: {
      type: "object",
      properties: {
        review_id: {
          type: "string",
          description: "ID of the review to respond to",
        },
        tone: {
          type: "string",
          enum: ["apologetic", "thankful", "professional"],
          description: "Tone of the response",
        },
        offer: {
          type: "string",
          description:
            'Optional offer to include (e.g., "discount", "free dessert")',
        },
      },
      required: ["review_id", "tone"],
    },
  },
};

const createLead: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_lead",
    description: "Create a new CRM lead from a customer inquiry.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["buy", "rent", "inquiry"],
          description: "Type of lead",
        },
        location: {
          type: "string",
          description: "Area or location of interest",
        },
        budget: { type: "number", description: "Budget in local currency" },
        timeframe: {
          type: "string",
          description: "Purchase/decision timeframe",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Lead urgency",
        },
        contact_phone: { type: "string", description: "Contact phone number" },
        notes: {
          type: "string",
          description: "Additional notes from the inquiry",
        },
      },
      required: ["type", "location"],
    },
  },
};

// ─── Menu / Query Tools ──────────────────────────────────────────────────────

const queryMenu: ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_menu",
    description:
      "Query the menu for items matching dietary preferences or search terms.",
    parameters: {
      type: "object",
      properties: {
        dietary_preference: {
          type: "string",
          description: 'Dietary filter (e.g., "vegan", "gluten-free", "halal")',
        },
        search_term: {
          type: "string",
          description: "Item name or keyword to search for",
        },
        category: {
          type: "string",
          description: 'Menu category (e.g., "starters", "mains", "desserts")',
        },
      },
      required: [],
    },
  },
};

// ─── All Tools Registry ───────────────────────────────────────────────────────

/** Complete list of all available tools */
export const ALL_TOOLS: ChatCompletionTool[] = [
  // Inventory
  updateInventory,
  logWaste,
  eightySixItem,
  createPurchaseOrder,
  // Orders & Delivery
  createDeliveryOrder,
  updateDeliveryStatus,
  voidOrder,
  updatePlatformStatus,
  // Sales
  getSalesSummary,
  compareSales,
  // Staff
  addEmployee,
  requestTimeOff,
  getSchedule,
  // Maintenance
  createMaintenanceTicket,
  updateMaintenanceTicket,
  getTaskStatus,
  // CRM / Reservations
  updateReservationStatus,
  getRecentReviews,
  draftReviewResponse,
  createLead,
  // Menu
  queryMenu,
];

/** Get a tool from the registry by name */
export function getToolByName(name: string): ChatCompletionTool | undefined {
  return ALL_TOOLS.find((t) => t.function.name === name);
}
