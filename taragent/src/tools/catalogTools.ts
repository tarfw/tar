import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const CATALOG_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_product",
      description:
        "Add a new product, menu item, or service SKU to a store's catalog.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          category: {
            type: "string",
            description: "e.g. 'starters', 'electronics', 'services'",
          },
          sku: { type: "string" },
          upc: {
            type: "string",
            description: "Barcode / UPC code if applicable",
          },
          attributes: {
            type: "object",
            description:
              "Flexible key-value attributes (size, colour, dietary…)",
          },
          available: { type: "boolean" },
        },
        required: ["store_id", "name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product",
      description:
        "Update an existing product's price, description, category, or attributes.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          description: { type: "string" },
          category: { type: "string" },
          attributes: { type: "object" },
          available: { type: "boolean" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "import_upc",
      description: "Import and enrich product data from a UPC/barcode scan.",
      parameters: {
        type: "object",
        properties: {
          upc: { type: "string", description: "UPC or EAN barcode string" },
          store_id: { type: "string" },
          price: { type: "number", description: "Override price (optional)" },
        },
        required: ["upc", "store_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_product_availability",
      description: "Enable or disable a product across the storefront.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          available: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["product_id", "available"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_catalog",
      description:
        "List products in a store's catalog, optionally filtered by category or availability.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          category: { type: "string" },
          available_only: { type: "boolean" },
          search: { type: "string" },
        },
        required: ["store_id"],
      },
    },
  },
];
