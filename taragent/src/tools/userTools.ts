import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const USER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_user",
      description: "Create or register a new user in the commerce system.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "User phone number (primary identifier)",
          },
          name: { type: "string", description: "Full display name" },
          email: { type: "string", description: "Email address" },
          role: {
            type: "string",
            enum: ["customer", "staff", "driver", "merchant"],
            description: "User role",
          },
        },
        required: ["phone", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user_profile",
      description: "Update an existing user's profile details.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User ID or phone number" },
          name: { type: "string" },
          email: { type: "string" },
          preferences: {
            type: "object",
            description: "Key-value preference map",
          },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user",
      description: "Retrieve a user's profile and preferences.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "User ID or phone number" },
        },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_user_preference",
      description:
        "Set a specific preference for a user (e.g. dietary, language, notifications).",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          key: {
            type: "string",
            description: "Preference key (e.g. 'language', 'dietary')",
          },
          value: { type: "string", description: "Preference value" },
        },
        required: ["user_id", "key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deactivate_user",
      description: "Deactivate or suspend a user account.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["user_id", "reason"],
      },
    },
  },
];
