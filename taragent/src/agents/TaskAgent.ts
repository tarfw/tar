// src/agents/TaskAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { TASK_TOOLS } from "../tools/taskTools";
import type { AgentType, GroupRole } from "../types";

export class TaskAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "task";
  }
  getAllTools() {
    return TASK_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("task", role);
  }
}
