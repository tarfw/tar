import { CORE_EVENT_SKILL_MARKDOWN } from './core-events';

/**
 * CORE_MODULES is maintained as a backwards-compatible alias layer
 * pointing to the core plan5.md event skill definitions.
 */
export const CORE_MODULES: Record<string, string> = {
  orders: CORE_EVENT_SKILL_MARKDOWN.transactions,
  inventory: CORE_EVENT_SKILL_MARKDOWN.inventory,
  bookings: CORE_EVENT_SKILL_MARKDOWN.schedule,
  crm: CORE_EVENT_SKILL_MARKDOWN.pipeline,
  logistics: CORE_EVENT_SKILL_MARKDOWN.logistics,
  projects: CORE_EVENT_SKILL_MARKDOWN.work,
  hr: CORE_EVENT_SKILL_MARKDOWN.work,
  expenses: CORE_EVENT_SKILL_MARKDOWN.money,
  listings: CORE_EVENT_SKILL_MARKDOWN.inventory,
  support: CORE_EVENT_SKILL_MARKDOWN.pipeline,
  reports: CORE_EVENT_SKILL_MARKDOWN.transactions,
  documents: CORE_EVENT_SKILL_MARKDOWN.work,
  'team-chat': CORE_EVENT_SKILL_MARKDOWN.work,

  // Direct Event Category Aliases
  transactions: CORE_EVENT_SKILL_MARKDOWN.transactions,
  schedule: CORE_EVENT_SKILL_MARKDOWN.schedule,
  pipeline: CORE_EVENT_SKILL_MARKDOWN.pipeline,
  work: CORE_EVENT_SKILL_MARKDOWN.work,
  money: CORE_EVENT_SKILL_MARKDOWN.money,

  // Extended ERP/CRM Module Aliases
  sales: CORE_EVENT_SKILL_MARKDOWN.transactions,
  purchasing: CORE_EVENT_SKILL_MARKDOWN.money,
  finance: CORE_EVENT_SKILL_MARKDOWN.money,
  commerce: CORE_EVENT_SKILL_MARKDOWN.transactions,
};
