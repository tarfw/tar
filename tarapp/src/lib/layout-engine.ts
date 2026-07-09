import { parseDesignTokens, DesignTokens } from './design-tokens';

export interface UISection {
  type: 'quick-actions' | 'metric-card' | 'data-table' | 'timeline-feed' | 'booking-grid' | 'catalog-grid' | 'report-chart' | 'status-board';
  title?: string;
  actions?: string[];
  data?: string;
  dataSource?: string;
  columns?: string[];
}

export interface WorkspaceAction {
  name: string;
  module: string;
  purpose: string;
  intents: string[];
  params: Array<{ name: string; type: 'text' | 'number' | 'select'; required: boolean }>;
  icon?: string;
}

export interface WorkspaceModuleLayout {
  moduleName: string;
  layout: string; // e.g. dashboard
  primaryAction?: string;
  sections: UISection[];
  actions: Record<string, WorkspaceAction>;
}

/**
 * Super lightweight YAML frontmatter parser for React Native client.
 */
export function parseYamlFrontmatter(mdContent: string): { frontmatter: any; markdownBody: string } {
  const parts = mdContent.split('---');
  if (parts.length < 3) {
    return { frontmatter: {}, markdownBody: mdContent };
  }
  
  const yamlText = parts[1];
  const markdownBody = parts.slice(2).join('---');
  
  const obj: any = {};
  const lines = yamlText.split('\n');
  
  let currentKey = '';
  let inList = false;
  let listKey = '';
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Check for inline arrays: key: [item1, item2]
    const inlineArrayMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*\[(.*)\]/);
    if (inlineArrayMatch) {
      const [_, key, itemsStr] = inlineArrayMatch;
      obj[key] = itemsStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      continue;
    }

    // Check for list items: - item
    if (trimmed.startsWith('-')) {
      const val = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '');
      if (inList && listKey) {
        if (!obj[listKey]) obj[listKey] = [];
        obj[listKey].push(val);
      }
      continue;
    }

    // Check for standard key-value: key: value
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      const [_, key, valStr] = kvMatch;
      const cleanVal = valStr.trim().replace(/^['"]|['"]$/g, '');
      
      if (cleanVal === '') {
        // Start of a nested block or list
        currentKey = key;
        inList = true;
        listKey = key;
        obj[key] = [];
      } else {
        inList = false;
        if (cleanVal === 'true') obj[key] = true;
        else if (cleanVal === 'false') obj[key] = false;
        else if (!isNaN(Number(cleanVal)) && cleanVal !== '') obj[key] = Number(cleanVal);
        else obj[key] = cleanVal;
      }
    }
  }

  // Fallbacks for nested objects like ui_hints.sections
  const parsedSections: UISection[] = [];
  let currentSection: any = null;
  
  // Custom manual parser for sections block in YAML
  let sectionLines = yamlText.split('\n');
  let inSections = false;
  
  for (let line of sectionLines) {
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    if (trimmed.startsWith('sections:')) {
      inSections = true;
      continue;
    }
    
    if (inSections) {
      if (indent === 0 && trimmed !== '') {
        inSections = false;
        continue;
      }
      
      if (trimmed.startsWith('- type:')) {
        if (currentSection) parsedSections.push(currentSection);
        const type = trimmed.replace('- type:', '').trim().replace(/^['"]|['"]$/g, '');
        currentSection = { type };
      } else if (trimmed.startsWith('title:') && currentSection) {
        currentSection.title = trimmed.replace('title:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed.startsWith('data:') && currentSection) {
        currentSection.data = trimmed.replace('data:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed.startsWith('actions:') && currentSection) {
        // e.g. actions: [record_sale, void_order]
        const actMatch = trimmed.match(/actions\s*:\s*\[(.*)\]/);
        if (actMatch) {
          currentSection.actions = actMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        }
      }
    }
  }
  if (currentSection) parsedSections.push(currentSection);
  
  if (parsedSections.length > 0) {
    if (!obj.ui_hints) obj.ui_hints = {};
    obj.ui_hints.sections = parsedSections;
  }
  
  return { frontmatter: obj, markdownBody };
}

export function buildModuleLayout(moduleName: string, mdContent: string): WorkspaceModuleLayout {
  const { frontmatter } = parseYamlFrontmatter(mdContent);
  
  const ui_hints = frontmatter.ui_hints || {};
  const sections: UISection[] = ui_hints.sections || [];
  const primaryAction = ui_hints.primary_action || '';
  const layout = ui_hints.layout || 'dashboard';

  const actions: Record<string, WorkspaceAction> = {};
  if (frontmatter.actions && Array.isArray(frontmatter.actions)) {
    frontmatter.actions.forEach((act: any) => {
      if (act && act.name) {
        actions[act.name] = {
          name: act.name,
          module: moduleName,
          purpose: act.purpose || `Execute ${act.name}`,
          intents: act.intents || [act.name.replace(/_/g, ' ')],
          params: act.params || [],
          icon: act.icon || 'play-outline',
        };
      }
    });
  }

  return {
    moduleName,
    layout,
    primaryAction,
    sections,
    actions,
  };
}
