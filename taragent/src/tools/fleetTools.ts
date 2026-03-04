import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const FLEET_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "dispatch_driver",
      description:
        "Automatically dispatch the nearest available driver to an order.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          store_lat: { type: "number" },
          store_lng: { type: "number" },
          algorithm: {
            type: "string",
            enum: ["nearest", "fastest", "least_busy"],
            description: "Dispatch strategy",
          },
        },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_deliveries",
      description:
        "Get all currently active deliveries in a zone or for a store.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          zone: { type: "string", description: "H3 geohash zone" },
          status: {
            type: "string",
            enum: ["assigned", "picked_up", "en_route", "all"],
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_delivery_zone",
      description: "Define a new delivery zone with boundaries and parameters.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          name: { type: "string" },
          radius_km: { type: "number" },
          center_lat: { type: "number" },
          center_lng: { type: "number" },
          min_order_value: { type: "number" },
          delivery_fee: { type: "number" },
        },
        required: ["store_id", "name", "radius_km", "center_lat", "center_lng"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fleet_status",
      description:
        "Get a real-time overview of all drivers: available, on delivery, offline.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          zone: { type: "string" },
        },
        required: [],
      },
    },
  },
];
