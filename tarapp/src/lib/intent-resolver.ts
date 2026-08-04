/**
 * Intent Resolver
 * Compiles a static keyword lookup index on workspace load.
 * Performs fast O(1) match on user text. Falls back to LLM only on no-match.
 */

export interface IntentResult {
  match: boolean;
  action?: 'clear' | 'show_module' | 'add_module' | 'remove_module' | 'compose_item' | 'chat';
  moduleName?: string;
  feedbackText?: string;
  itemData?: {
    title?: string;
    price?: number;
    stock?: number;
    category?: string;
    item_subtype?: string;
    sku?: string;
  };
}

const MODULE_KEYWORDS: Record<string, string[]> = {
  site: ['site', 'website', 'storefront', 'web', 'page', 'publish'],
  transactions: ['transaction', 'order', 'sale', 'sales', 'pos', 'receipt', 'billing', 'refund', 'invoice', 'void'],
  orders: ['order', 'sale', 'sales', 'pos', 'transaction', 'receipt', 'billing', 'refund', 'invoice'],
  inventory: ['inventory', 'stock', 'product', 'item', 'catalog', 'warehouse', 'add product', 'add item', 'adjust', 'write off'],
  schedule: ['schedule', 'booking', 'book', 'slot', 'calendar', 'appointment', 'cancel'],
  bookings: ['booking', 'book', 'slot', 'calendar', 'appointment', 'schedule', 'salon', 'clinic'],
  pipeline: ['pipeline', 'crm', 'customer', 'client', 'lead', 'leads', 'contact', 'deal', 'stage', 'activity', 'company', 'account', 'convert lead', 'add lead', 'add company'],
  crm: ['crm', 'customer', 'client', 'lead', 'leads', 'contact', 'deal', 'pipeline', 'company', 'account', 'people', 'directory', 'companies', 'items', 'convert lead', 'add lead', 'add company'],
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

  // 4. Chat-to-Compose (Add / Create Item intent)
  const composeMatch = cleanText.match(/^(add|create|new)\s+(product|item|listing|service|asset)\s+(.+)/i);
  if (composeMatch) {
    const rawSubtype = composeMatch[2].toLowerCase();
    const restStr = composeMatch[3];

    // Extract price ($XX.XX or price XX)
    const priceMatch = restStr.match(/(?:\$|price\s+|cost\s+)(\d+(?:\.\d+)?)/i);
    const priceVal = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Extract stock (XX units / stock XX / qty XX)
    const stockMatch = restStr.match(/(\d+)\s*(?:units|qty|stock|pcs)?|stock\s+(\d+)|qty\s+(\d+)/i);
    const stockVal = stockMatch ? parseInt(stockMatch[1] || stockMatch[2] || stockMatch[3]) : 0;

    // Extract category (under / category XX)
    const catMatch = restStr.match(/(?:category|under|in)\s+([a-zA-Z0-9_\s]+?)(?:\s+at|\s+for|\s+with|\s+price|\s*$)/i);
    const catVal = catMatch ? catMatch[1].trim() : '';

    // Extract title (clean rest string)
    const cleanTitle = restStr
      .replace(/(?:\$|price\s+|cost\s+)\d+(?:\.\d+)?/gi, '')
      .replace(/\d+\s*(?:units|qty|stock|pcs)/gi, '')
      .replace(/(?:category|under|in)\s+[a-zA-Z0-9_\s]+/gi, '')
      .replace(/^(at|for|with)\s+/gi, '')
      .trim();

    const subtypeLabel = rawSubtype.charAt(0).toUpperCase() + rawSubtype.slice(1);

    return {
      match: true,
      action: 'compose_item',
      feedbackText: `Opening Item Compose for "${cleanTitle || 'New Item'}"...`,
      itemData: {
        title: cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : 'New Item',
        price: priceVal,
        stock: stockVal,
        category: catVal,
        item_subtype: subtypeLabel === 'Item' ? 'Product' : subtypeLabel,
      },
    };
  }

  // 5. Direct system aliases
  if (/^(show|list|get|view)\s+(products|menu|services|inventory)/i.test(cleanText)) {
    return { match: true, action: 'show_module', moduleName: 'inventory', feedbackText: 'Loaded latest product inventory.' };
  }
  if (/^(show|list|get|view)\s+(orders|sales)/i.test(cleanText)) {
    return { match: true, action: 'show_module', moduleName: 'orders', feedbackText: 'Loaded latest orders.' };
  }

  // 6. Scan active modules keyword map
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
