import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const INVENTORY_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "update_stock",
      description:
        "Update the quantity of any inventory item (product, ingredient, or SKU).",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "Item name or SKU" },
          quantity: { type: "number" },
          unit: {
            type: "string",
            description: "Unit of measure (kg, units, litres, bags…)",
          },
          store_id: { type: "string" },
          action: {
            type: "string",
            enum: ["set", "add", "subtract"],
            description: "How to apply the quantity",
          },
        },
        required: ["item", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_waste",
      description: "Log a waste or shrinkage event for an inventory item.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          reason: {
            type: "string",
            description: "Reason (expired, damaged, spoiled, theft…)",
          },
          store_id: { type: "string" },
        },
        required: ["item", "quantity", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_unavailable",
      description:
        "Mark an item as out-of-stock or unavailable across all menus/storefronts.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string" },
          available: {
            type: "boolean",
            description: "false = out of stock, true = restore",
          },
          store_id: { type: "string" },
        },
        required: ["item", "available"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_purchase_order",
      description: "Generate a supplier purchase order to restock inventory.",
      parameters: {
        type: "object",
        properties: {
          supplier: { type: "string" },
          items: {
            type: "array",
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
          store_id: { type: "string" },
          expected_date: {
            type: "string",
            description: "Expected delivery date (YYYY-MM-DD)",
          },
        },
        required: ["supplier", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_levels",
      description:
        "Get current stock levels for a store, optionally filtered by low-stock threshold.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          low_stock_only: {
            type: "boolean",
            description: "Return only items below minimum threshold",
          },
          category: { type: "string" },
        },
        required: ["store_id"],
      },
    },
  },
];
