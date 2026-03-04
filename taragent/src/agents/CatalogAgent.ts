// src/agents/CatalogAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { CATALOG_TOOLS } from "../tools/catalogTools";
import type { AgentType, GroupRole } from "../types";

export class CatalogAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "catalog";
  }
  getAllTools() {
    return CATALOG_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("catalog", role);
  }
}
