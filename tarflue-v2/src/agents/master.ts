import { defineAgent, type AgentRouteHandler } from '@flue/runtime';
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
import { allTools } from '../tools';

export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(() => ({
  model: 'groq/openai/gpt-oss-120b',
  instructions: `You are the tar. universal assistant running on Cloudflare.
You manage storefronts, orders, inventory, and customer interactions.
You have access to tools for creating, reading, updating, and searching entities.
Delegate to specialist subagents based on the user's request.`,
  tools: allTools,
  subagents: [
    agentCrm, agentLogistics, agentSupport, agentHr, agentRealEstate,
    agentEcommerce, agentProjects, agentBooking, agentInventory, agentLms,
  ],
}));
