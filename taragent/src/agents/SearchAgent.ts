// src/agents/SearchAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { SEARCH_TOOLS } from "../tools/searchTools";
import type { AgentType, GroupRole } from "../types";

export class SearchAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "search";
  }
  getAllTools() {
    return SEARCH_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("search", role);
  }
}
