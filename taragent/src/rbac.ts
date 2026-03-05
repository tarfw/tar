// src/rbac.ts — Agent-scoped Role-Based Access Control
//
// Each agent has its own role → allowed tools map.
// getToolsForAgent(agentType, role, allTools) returns the filtered subset.

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { AgentType, GroupRole } from "./types";

// ─── Role → Allowed Tool Names per Agent ──────────────────────────────────────

const AGENT_ROLE_TOOLS: Record<
  AgentType,
  Record<GroupRole | "default", string[] | "all">
> = {
  user: {
    management: "all",
    staff: ["get_user", "update_user_profile"],
    customer: ["get_user", "update_user_profile", "set_user_preference"],
    driver: ["get_user"],
    readonly: ["get_user"],
    default: "all",
  },
  store: {
    management: "all",
    staff: ["set_store_status", "set_store_hours", "get_store_metrics"],
    customer: ["get_store_metrics"],
    driver: ["get_store_metrics"],
    readonly: ["get_store_metrics"],
    default: "all",
  },
  order: {
    management: "all",
    staff: [
      "create_order",
      "update_order_status",
      "get_order",
      "list_orders",
      "add_order_item",
    ],
    customer: ["create_order", "get_order"],
    driver: ["update_order_status", "get_order"],
    readonly: ["get_order", "list_orders"],
    default: "all",
  },
  driver: {
    management: "all",
    staff: [
      "assign_order_to_driver",
      "get_driver_stats",
      "set_driver_status",
      "log_driver_issue",
    ],
    customer: [],
    driver: ["update_driver_location", "set_driver_status", "log_driver_issue"],
    readonly: ["get_driver_stats"],
    default: "all",
  },
  inventory: {
    management: "all",
    staff: [
      "update_stock",
      "log_waste",
      "mark_unavailable",
      "create_purchase_order",
      "get_stock_levels",
    ],
    customer: ["get_stock_levels"],
    driver: ["get_stock_levels"],
    readonly: ["get_stock_levels"],
    default: "all",
  },
  catalog: {
    management: "all",
    staff: [
      "create_product",
      "update_product",
      "set_product_availability",
      "list_catalog",
      "import_upc",
    ],
    customer: ["list_catalog"],
    driver: ["list_catalog"],
    readonly: ["list_catalog"],
    default: "all",
  },
  fleet: {
    management: "all",
    staff: ["dispatch_driver", "get_active_deliveries", "get_fleet_status"],
    customer: ["get_active_deliveries"],
    driver: ["get_active_deliveries"],
    readonly: ["get_fleet_status", "get_active_deliveries"],
    default: "all",
  },
  chat: {
    management: "all",
    staff: ["send_message", "broadcast_announcement", "get_messages"],
    customer: ["send_message"],
    driver: ["send_message", "get_messages"],
    readonly: ["get_messages"],
    default: "all",
  },
  search: {
    management: "all",
    staff: [
      "search_products",
      "search_stores",
      "search_orders",
      "index_entity",
    ],
    customer: ["search_products", "search_stores"],
    driver: ["search_products", "search_stores", "search_orders"],
    readonly: ["search_products", "search_stores"],
    default: "all",
  },
  task: {
    management: "all",
    staff: [
      "create_task",
      "update_task_status",
      "list_pending_tasks",
      "schedule_job",
    ],
    customer: [],
    driver: ["update_task_status", "list_pending_tasks"],
    readonly: ["list_pending_tasks"],
    default: "all",
  },
};

// ─── Public Helpers ───────────────────────────────────────────────────────────

/**
 * Returns filtered tool list for a given agent + role.
 * Agents receive only the tools allowed for their role.
 */
export function getToolsForAgent(
  agentType: AgentType,
  role: GroupRole,
  allTools: ChatCompletionTool[],
): ChatCompletionTool[] {
  const roleMap = AGENT_ROLE_TOOLS[agentType];
  const allowed = roleMap?.[role] ?? roleMap?.default ?? "all";
  if (allowed === "all") return allTools;
  const set = new Set(allowed);
  return allTools.filter((t) => set.has(t.function.name));
}

/** Server-side RBAC check before executing a tool. */
export function isToolAllowedForAgent(
  toolName: string,
  agentType: AgentType,
  role: GroupRole,
  allTools: ChatCompletionTool[],
): boolean {
  const filtered = getToolsForAgent(agentType, role, allTools);
  return filtered.some((t) => t.function.name === toolName);
}
