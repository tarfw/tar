// src/rbac.ts — Role-Based Access Control for TAR Agent
// Maps a group role → the subset of tool names it may use.
// The Worker queries the Turso DB to resolve a chatGroupId → GroupRole,
// then only sends Groq the tools for that role — making it impossible for
// the LLM to execute actions outside its remit.

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { ALL_TOOLS } from "./tools";
import type { GroupRole } from "./types";

// ─── Role → Allowed Tool Names ────────────────────────────────────────────────

const ROLE_TOOLS: Record<GroupRole, string[]> = {
  /** Management VIP: full access to everything */
  management: ALL_TOOLS.map((t) => t.function.name),

  /** Kitchen staff: inventory + maintenance + 86 items */
  kitchen: [
    "update_inventory",
    "log_waste",
    "86_item",
    "create_purchase_order",
    "create_maintenance_ticket",
    "update_maintenance_ticket",
    "get_task_status",
    "query_menu",
  ],

  /** Front-of-house: reservations + menu queries */
  front_of_house: [
    "update_reservation_status",
    "query_menu",
    "get_recent_reviews",
    "draft_review_response",
  ],

  /** Delivery operations: order management + driver status */
  delivery: [
    "create_delivery_order",
    "update_delivery_status",
    "void_order",
    "query_menu",
  ],

  /** Default (unknown group): full access — restrict per-group via group-role API */
  default: ALL_TOOLS.map((t) => t.function.name),
};

// ─── Public Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the filtered list of ChatCompletionTool objects for the given role.
 * Only tools in ROLE_TOOLS[role] are included.
 */
export function getToolsForRole(role: GroupRole): ChatCompletionTool[] {
  const allowed = new Set(ROLE_TOOLS[role] ?? ROLE_TOOLS.default);
  return ALL_TOOLS.filter((t) => allowed.has(t.function.name));
}

/**
 * Checks whether a tool name is allowed for a given role.
 * Used for server-side validation before executing a tool call.
 */
export function isToolAllowed(toolName: string, role: GroupRole): boolean {
  const allowed = ROLE_TOOLS[role] ?? ROLE_TOOLS.default;
  return allowed.includes(toolName);
}

/**
 * Resolves a platform-specific group ID to a GroupRole.
 * Falls back to 'default' if no mapping is found.
 */
export function resolveRole(
  chatGroupId: string,
  groupRoles: Record<string, GroupRole>,
): GroupRole {
  return groupRoles[chatGroupId] ?? "default";
}
