// src/agents/OrderAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { ORDER_TOOLS } from "../tools/orderTools";
import type { AgentType, GroupRole } from "../types";

export class OrderAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "order";
  }
  getAllTools() {
    return ORDER_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("order", role);
  }
}
