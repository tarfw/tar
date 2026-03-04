import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const STORE_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_store",
      description: "Register a new merchant store or business location.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Store name" },
          type: {
            type: "string",
            description:
              "Business type (e.g. restaurant, retail, pharmacy, service)",
          },
          address: { type: "string" },
          phone: { type: "string" },
          owner_id: { type: "string", description: "User ID of the owner" },
        },
        required: ["name", "type", "address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_store_config",
      description:
        "Update store settings such as name, address, delivery radius, or commission.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
          delivery_radius_km: { type: "number" },
          commission_pct: { type: "number" },
          settings: { type: "object" },
        },
        required: ["store_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_store_hours",
      description: "Set or update the operating hours for a store.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          hours: {
            type: "object",
            description: "Map of day → { open: 'HH:MM', close: 'HH:MM' }",
          },
        },
        required: ["store_id", "hours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_store_status",
      description:
        "Open, close, or pause a store's storefront on the platform.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          status: {
            type: "string",
            enum: ["open", "closed", "paused", "busy"],
          },
          reason: {
            type: "string",
            description: "Optional reason (e.g. 'staff shortage')",
          },
          until: {
            type: "string",
            description: "ISO datetime when to auto-reopen (optional)",
          },
        },
        required: ["store_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_store_metrics",
      description:
        "Get performance metrics for a store: orders, revenue, ratings.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          period: {
            type: "string",
            enum: ["today", "yesterday", "this_week", "this_month"],
            description: "Time period",
          },
        },
        required: ["store_id", "period"],
      },
    },
  },
];
