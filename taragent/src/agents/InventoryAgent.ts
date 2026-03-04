// src/agents/InventoryAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { INVENTORY_TOOLS } from "../tools/inventoryTools";
import type { AgentType, GroupRole } from "../types";

export class InventoryAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "inventory";
  }
  getAllTools() {
    return INVENTORY_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("inventory", role);
  }
}
