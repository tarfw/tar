import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const ORDER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_order",
      description:
        "Create a new order for any commerce type: food, product, service, or booking.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "Customer user ID or phone",
          },
          store_id: { type: "string", description: "Store or merchant ID" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                name: { type: "string" },
                qty: { type: "number" },
                unit_price: { type: "number" },
              },
              required: ["name", "qty"],
            },
          },
          order_type: {
            type: "string",
            enum: ["delivery", "pickup", "dine_in", "service", "digital"],
            description: "Order fulfilment type",
          },
          address: {
            type: "string",
            description: "Delivery address if applicable",
          },
          notes: { type: "string" },
          scheduled_at: {
            type: "string",
            description: "ISO datetime for future orders",
          },
        },
        required: ["customer_id", "store_id", "items", "order_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "Update the status of any existing order.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          status: {
            type: "string",
            enum: [
              "placed",
              "confirmed",
              "preparing",
              "ready",
              "out_for_delivery",
              "delivered",
              "completed",
              "cancelled",
            ],
          },
          notes: { type: "string" },
        },
        required: ["order_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "void_order",
      description: "Cancel or void any order and trigger refund if applicable.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          reason: { type: "string" },
          refund: { type: "boolean", description: "Whether to issue a refund" },
        },
        required: ["order_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order",
      description: "Retrieve details of a specific order.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
        },
        required: ["order_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "List orders filtered by store, customer, status, or date.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          customer_id: { type: "string" },
          status: { type: "string" },
          date: {
            type: "string",
            description: "'today', 'yesterday', or ISO date",
          },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_order_item",
      description: "Add an item to an existing open order.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          name: { type: "string" },
          qty: { type: "number" },
          unit_price: { type: "number" },
        },
        required: ["order_id", "name", "qty"],
      },
    },
  },
];
