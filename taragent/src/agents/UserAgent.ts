// src/agents/UserAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { USER_TOOLS } from "../tools/userTools";
import type { AgentType, GroupRole } from "../types";

export class UserAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "user";
  }
  getAllTools() {
    return USER_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("user", role);
  }
}
