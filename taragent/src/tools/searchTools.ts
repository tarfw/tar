import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const SEARCH_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the product catalog across stores by keyword, category, or dietary filter.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
          store_id: { type: "string" },
          dietary: {
            type: "string",
            description: "e.g. vegan, gluten-free, halal",
          },
          max_price: { type: "number" },
          available_only: { type: "boolean" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stores",
      description: "Search for stores by name, type, location, or rating.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          type: {
            type: "string",
            description: "Business type (restaurant, pharmacy, retail…)",
          },
          lat: { type: "number" },
          lng: { type: "number" },
          radius_km: { type: "number" },
          open_now: { type: "boolean" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search orders by customer, store, date range, or status.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free-text search (customer name, order ID, item)",
          },
          store_id: { type: "string" },
          customer_id: { type: "string" },
          from_date: { type: "string" },
          to_date: { type: "string" },
          status: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "index_entity",
      description:
        "Add or update an entity (product, store, user) in the search index.",
      parameters: {
        type: "object",
        properties: {
          entity_type: {
            type: "string",
            enum: ["product", "store", "user", "order"],
          },
          entity_id: { type: "string" },
          data: { type: "object", description: "Entity data to index" },
        },
        required: ["entity_type", "entity_id", "data"],
      },
    },
  },
];
