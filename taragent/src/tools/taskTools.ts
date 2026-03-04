import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const TASK_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a background task or operational checklist item.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          assigned_to: {
            type: "string",
            description: "User ID or role (e.g. 'kitchen')",
          },
          store_id: { type: "string" },
          due: {
            type: "string",
            description:
              "ISO datetime or natural language ('tonight', 'tomorrow 9am')",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
          recurring: {
            type: "string",
            description: "Recurrence rule (e.g. 'daily', 'every_monday')",
          },
        },
        required: ["title", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task_status",
      description:
        "Mark a task or checklist item as in-progress, done, or blocked.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "in_progress", "done", "blocked", "cancelled"],
          },
          notes: { type: "string" },
        },
        required: ["task_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_job",
      description:
        "Schedule an automated background job (e.g. daily stock report, auto-pause at closing time).",
      parameters: {
        type: "object",
        properties: {
          job_type: {
            type: "string",
            description:
              "e.g. 'daily_report', 'auto_close_store', 'low_stock_alert'",
          },
          cron: {
            type: "string",
            description: "Cron expression or natural language schedule",
          },
          store_id: { type: "string" },
          payload: { type: "object", description: "Job-specific parameters" },
        },
        required: ["job_type", "cron"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_tasks",
      description: "List all pending or overdue tasks for a store or assignee.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "string" },
          assigned_to: { type: "string" },
          priority: { type: "string" },
          overdue_only: { type: "boolean" },
        },
        required: [],
      },
    },
  },
];
