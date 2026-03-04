// src/agents/DriverAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { DRIVER_TOOLS } from "../tools/driverTools";
import type { AgentType, GroupRole } from "../types";

export class DriverAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "driver";
  }
  getAllTools() {
    return DRIVER_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("driver", role);
  }
}
