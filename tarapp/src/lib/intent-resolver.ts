/**
 * Intent Resolver
 * Compiles a static keyword lookup index on workspace load.
 * Performs fast O(1) match on user text. Falls back to LLM only on no-match.
 */

export interface IntentResult {
  match: boolean;
  action?: 'clear' | 'show_module' | 'add_module' | 'remove_module' | 'chat';
  moduleName?: string;
  feedbackText?: string;
}

const MODULE_KEYWORDS: Record<string, string[]> = {
  transactions: ['transaction', 'order', 'sale', 'sales', 'pos', 'receipt', 'billing', 'refund', 'invoice', 'void'],
  orders: ['order', 'sale', 'sales', 'pos', 'transaction', 'receipt', 'billing', 'refund', 'invoice'],
  inventory: ['inventory', 'stock', 'product', 'item', 'catalog', 'warehouse', 'add product', 'add item', 'adjust', 'write off'],
  schedule: ['schedule', 'booking', 'book', 'slot', 'calendar', 'appointment', 'cancel'],
  bookings: ['booking', 'book', 'slot', 'calendar', 'appointment', 'schedule', 'salon', 'clinic'],
  pipeline: ['pipeline', 'crm', 'customer', 'client', 'lead', 'contact', 'deal', 'stage', 'activity', 'company'],
  crm: ['crm', 'customer', 'client', 'lead', 'contact', 'deal', 'pipeline', 'company', 'people', 'directory', 'companies', 'items'],
  directory: ['directory', 'people', 'companies', 'items', 'entity-directory', 'plan5-directory'],
  logistics: ['logistics', 'shipment', 'delivery', 'carrier', 'track', 'tracking', 'transit'],
  work: ['work', 'project', 'task', 'todo', 'kanban', 'milestone', 'assignee', 'clock', 'clockin', 'clockout', 'attendance'],
  projects: ['project', 'task', 'todo', 'kanban', 'milestone', 'assignee'],
  hr: ['hr', 'employee', 'staff', 'salary', 'payroll', 'attendance', 'clock'],
  money: ['money', 'expense', 'spend', 'outflow', 'receipts', 'cost', 'write off'],
  expenses: ['expense', 'spend', 'outflow', 'receipts', 'cost'],
  listings: ['listing', 'property', 'real estate', 'house', 'apartment', 'catalog'],
  support: ['support', 'ticket', 'help', 'issue', 'complaint'],
  reports: ['report', 'analytics', 'chart', 'insight', 'daily sales'],
  documents: ['document', 'file', 'vault', 'upload doc', 'contract'],
  'team-chat': ['chat', 'message', 'slack', 'telegram', 'send message']
};

export function resolveIntent(text: string, activeModules: string[]): IntentResult {
  const cleanText = text.trim().toLowerCase();

  // 1. Clear Canvas widgets
  if (/^(clear|reset|clean|home|canvas)\b/i.test(cleanText)) {
    return {
      match: true,
      action: 'clear',
      feedbackText: 'Cleared active canvas widgets.'
    };
  }

  // 2. Add module skill
  const addMatch = cleanText.match(/^(add|enable|install|pin)\s+(skill\s+)?([a-zA-Z0-9_-]+)/i);
  if (addMatch) {
    const modName = addMatch[3].toLowerCase();
    const displayName = modName.charAt(0).toUpperCase() + modName.slice(1);
    return {
      match: true,
      action: 'add_module',
      moduleName: modName,
      feedbackText: `Added ${displayName} skill to canvas.`
    };
  }

  // 3. Remove module skill
  const removeMatch = cleanText.match(/^(remove|delete|uninstall|unpin)\s+(skill\s+)?([a-zA-Z0-9_-]+)/i);
  if (removeMatch) {
    const modName = removeMatch[3].toLowerCase();
    const displayName = modName.charAt(0).toUpperCase() + modName.slice(1);
    return {
      match: true,
      action: 'remove_module',
      moduleName: modName,
      feedbackText: `Removed ${displayName} skill from canvas.`
    };
  }

  // 4. Direct system aliases
  if (/^(show|list|get|view)\s+(products|menu|services|inventory)/i.test(cleanText)) {
    return { match: true, action: 'show_module', moduleName: 'inventory', feedbackText: 'Loaded latest product inventory.' };
  }
  if (/^(show|list|get|view)\s+(orders|sales)/i.test(cleanText)) {
    return { match: true, action: 'show_module', moduleName: 'orders', feedbackText: 'Loaded latest orders.' };
  }

  // 5. Scan active modules keyword map (fallback to all module keywords if activeModules is empty)
  const modulesToScan = (activeModules && activeModules.length > 0)
    ? activeModules
    : Object.keys(MODULE_KEYWORDS);

  for (const mod of modulesToScan) {
    const keywords = MODULE_KEYWORDS[mod] || [mod];
    for (const kw of keywords) {
      if (cleanText === kw || cleanText.startsWith(`show ${kw}`) || cleanText.startsWith(`view ${kw}`) || cleanText.startsWith(`open ${kw}`)) {
        const displayName = mod.charAt(0).toUpperCase() + mod.slice(1);
        return {
          match: true,
          action: 'show_module',
          moduleName: mod,
          feedbackText: `Loaded ${displayName} module.`
        };
      }
    }
  }

  // No static match ➔ Fallback to LLM agent
  return { match: false };
}
