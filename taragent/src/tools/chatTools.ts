import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const CHAT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_message",
      description:
        "Send a message to a user or group on any platform (Telegram, WhatsApp, Slack).",
      parameters: {
        type: "object",
        properties: {
          recipient_id: {
            type: "string",
            description: "User ID, phone, or channel ID",
          },
          text: { type: "string" },
          platform: { type: "string", enum: ["telegram", "whatsapp", "slack"] },
          reply_to: {
            type: "string",
            description: "Message ID to reply to (optional)",
          },
        },
        required: ["recipient_id", "text", "platform"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "broadcast_announcement",
      description:
        "Send an announcement to all members of a group or all staff of a store.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          text: { type: "string" },
          audience: {
            type: "string",
            enum: [
              "all_staff",
              "kitchen",
              "drivers",
              "management",
              "customers",
            ],
          },
          platform: { type: "string", enum: ["telegram", "whatsapp", "slack"] },
        },
        required: ["text", "audience"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_channel",
      description: "Create a new group or channel for a team or store.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          platform: { type: "string", enum: ["telegram", "slack"] },
          purpose: {
            type: "string",
            description: "e.g. 'Kitchen updates', 'Driver coordination'",
          },
          store_id: { type: "string" },
        },
        required: ["name", "platform"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_messages",
      description: "Retrieve recent messages from a channel or conversation.",
      parameters: {
        type: "object",
        properties: {
          channel_id: { type: "string" },
          limit: { type: "number" },
          since: {
            type: "string",
            description: "ISO timestamp — fetch messages after this time",
          },
        },
        required: ["channel_id"],
      },
    },
  },
];
