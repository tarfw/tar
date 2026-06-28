import { defineAgent, defineAgentProfile } from '@flue/runtime';
import {
  toolCreateMatter, toolGetMatter, toolListMatters, toolUpdateMatter,
  toolAppendMotion, toolReadMotions, toolLinkGraph, toolTraverseGraph,
  toolSetAttr, toolSearchMemory, toolStoreMemory, toolReadForm,
} from '@/tools/core';
import {
  actionLogEvent, actionAdvanceStage, actionScore, actionNotify, actionEmbed, actionRunPipeline,
} from '@/actions/core';

import { agentCrm } from './profiles/crm';
import { agentLogistics } from './profiles/logistics';
import { agentSupport } from './profiles/support';
import { agentHr } from './profiles/hr';
import { agentRealEstate } from './profiles/realestate';
import { agentEcommerce } from './profiles/ecommerce';
import { agentProjects } from './profiles/projects';
import { agentBooking } from './profiles/booking';
import { agentInventory } from './profiles/inventory';
import { agentLms } from './profiles/lms';

export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: `You are the tar. universal assistant — a single AI that manages every business vertical.

You have access to 12 tools for database operations, 6 core actions for business logic, and 10 specialist subagents for vertical-specific work.

When a user asks about CRM, delegate to agent-crm.
When a user asks about logistics, delegate to agent-logistics.
When a user asks about support tickets, delegate to agent-support.
When a user asks about HR/attendance, delegate to agent-hr.
When a user asks about real estate, delegate to agent-realestate.
When a user asks about e-commerce/POS, delegate to agent-ecommerce.
When a user asks about projects/tasks, delegate to agent-projects.
When a user asks about bookings, delegate to agent-booking.
When a user asks about inventory, delegate to agent-inventory.
When a user asks about courses/learning, delegate to agent-lms.

For general queries, use the tools directly.
Always log events to the motion table for audit trails.
Always use attr for indexed fields like status, priority, assignee.
Always use graph for relationships between entities.`,
  tools: [
    toolCreateMatter, toolGetMatter, toolListMatters, toolUpdateMatter,
    toolAppendMotion, toolReadMotions, toolLinkGraph, toolTraverseGraph,
    toolSetAttr, toolSearchMemory, toolStoreMemory, toolReadForm,
  ],
  actions: [
    actionLogEvent, actionAdvanceStage, actionScore, actionNotify, actionEmbed, actionRunPipeline,
  ],
  subagents: [
    agentCrm, agentLogistics, agentSupport, agentHr, agentRealEstate,
    agentEcommerce, agentProjects, agentBooking, agentInventory, agentLms,
  ],
}));
