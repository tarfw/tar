// src/agents/StoreAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { STORE_TOOLS } from "../tools/storeTools";
import type { AgentType, GroupRole } from "../types";

export class StoreAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "store";
  }
  getAllTools() {
    return STORE_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("store", role);
  }
}
