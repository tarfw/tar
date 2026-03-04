// src/agents/FleetAgent.ts
import { BaseCommerceAgent } from "../base/BaseCommerceAgent";
import { buildSystemPrompt } from "../prompts";
import { FLEET_TOOLS } from "../tools/fleetTools";
import type { AgentType, GroupRole } from "../types";

export class FleetAgent extends BaseCommerceAgent {
  getAgentType(): AgentType {
    return "fleet";
  }
  getAllTools() {
    return FLEET_TOOLS;
  }
  buildPrompt(role: GroupRole) {
    return buildSystemPrompt("fleet", role);
  }
}
