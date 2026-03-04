// src/agents/ChatAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { CHAT_TOOLS } from "../tools/chatTools";
import type { AgentType, GroupRole } from "../types";

export class ChatAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "chat";
  }
  getAllTools() {
    return CHAT_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("chat", role);
  }
}
