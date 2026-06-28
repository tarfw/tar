import { defineAgent } from '@flue/runtime';
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

/**
 * Master Agent for tarflue (Cloudflare Worker).
 * This agent runs on CF and uses DO-based tools.
 * The local SQLite tools from tarai are replaced with CF-native tools.
 */
export default defineAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  instructions: `You are the tar. universal assistant running on Cloudflare.
You manage storefronts, orders, inventory, and customer interactions.
Delegate to specialist subagents based on the user's request.`,
  subagents: [
    agentCrm, agentLogistics, agentSupport, agentHr, agentRealEstate,
    agentEcommerce, agentProjects, agentBooking, agentInventory, agentLms,
  ],
}));
