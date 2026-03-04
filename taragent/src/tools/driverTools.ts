import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const DRIVER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "update_driver_location",
      description: "Update the real-time GPS location of a delivery driver.",
      parameters: {
        type: "object",
        properties: {
          driver_id: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          h3: {
            type: "string",
            description: "Optional H3 geohash for zone-level bucketing",
          },
        },
        required: ["driver_id", "lat", "lng"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_driver_status",
      description: "Set a driver's availability status.",
      parameters: {
        type: "object",
        properties: {
          driver_id: { type: "string" },
          status: {
            type: "string",
            enum: ["available", "on_delivery", "offline", "break"],
          },
          notes: { type: "string" },
        },
        required: ["driver_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_order_to_driver",
      description: "Assign a delivery order to a specific driver.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          driver_id: { type: "string" },
        },
        required: ["order_id", "driver_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_driver_stats",
      description: "Get delivery performance stats for a driver over a period.",
      parameters: {
        type: "object",
        properties: {
          driver_id: { type: "string" },
          period: {
            type: "string",
            enum: ["today", "this_week", "this_month"],
          },
        },
        required: ["driver_id", "period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_driver_issue",
      description:
        "Log an issue reported by or about a driver (vehicle, customer dispute, etc.).",
      parameters: {
        type: "object",
        properties: {
          driver_id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "vehicle",
              "customer_dispute",
              "accident",
              "no_show",
              "other",
            ],
          },
          description: { type: "string" },
          order_id: {
            type: "string",
            description: "Related order if applicable",
          },
        },
        required: ["driver_id", "type", "description"],
      },
    },
  },
];
