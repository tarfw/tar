import { parseDesignTokens, DesignTokens } from './design-tokens';

export interface UISection {
  type: 'quick-actions' | 'metric-card' | 'data-table' | 'timeline-feed' | 'booking-grid' | 'catalog-grid' | 'report-chart' | 'status-board' | 'entity-navigator' | 'entity-directory' | 'plan5-directory' | 'explore-feed' | 'inbox-feed';
  title?: string;
  actions?: string[];
  data?: string;
  dataSource?: string;
  columns?: string[];
  entities?: string[];
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

  // Fallbacks for nested objects like app_layout.sections
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
      } else if (trimmed.startsWith('entities:') && currentSection) {
        // e.g. entities: [pipeline, contacts]
        const entMatch = trimmed.match(/entities\s*:\s*\[(.*)\]/);
        if (entMatch) {
          currentSection.entities = entMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        }
      }
    }
  }
  if (currentSection) parsedSections.push(currentSection);
  
  if (parsedSections.length > 0) {
    if (!obj.app_layout) obj.app_layout = {};
    obj.app_layout.sections = parsedSections;
  }

  // Custom manual parser for actions block in YAML
  const parsedActions: any[] = [];
  let currentAction: any = null;
  let inActions = false;
  let actionLines = yamlText.split('\n');

  for (let line of actionLines) {
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    if (trimmed.startsWith('actions:')) {
      inActions = true;
      continue;
    }

    if (inActions) {
      if (indent === 0 && trimmed !== '') {
        inActions = false;
        continue;
      }

      if (trimmed.startsWith('- name:')) {
        if (currentAction) parsedActions.push(currentAction);
        const name = trimmed.replace('- name:', '').trim().replace(/^['"]|['"]$/g, '');
        currentAction = { name, params: [] };
      } else if (trimmed.startsWith('icon:') && currentAction) {
        currentAction.icon = trimmed.replace('icon:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed.startsWith('params:') && currentAction) {
        const paramsMatch = trimmed.match(/params\s*:\s*\[(.*)\]/);
        if (paramsMatch) {
          currentAction.params = paramsMatch[1]
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
            .map(pName => ({ name: pName, type: 'text', required: true }));
        }
      }
    }
  }
  if (currentAction) parsedActions.push(currentAction);

  if (parsedActions.length > 0) {
    obj.actions = parsedActions;
  }
  
  return { frontmatter: obj, markdownBody };
}

export function buildModuleLayout(moduleName: string, mdContent: string): WorkspaceModuleLayout {
  const { frontmatter } = parseYamlFrontmatter(mdContent);
  
  const app_layout = frontmatter.app_layout || {};
  const sections: UISection[] = app_layout.sections || [];
  const primaryAction = app_layout.primary_action || '';
  const layout = app_layout.layout || 'dashboard';

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

export interface CanvasBlock {
  title: string;
  type: string;
  props: Record<string, any>;
}

export function parseCanvasMarkdown(content: string): { title: string; blocks: CanvasBlock[] } {
  const parts = content.split('---');
  if (parts.length < 3) {
    return { title: 'Workspace Canvas', blocks: [] };
  }
  
  const yamlText = parts[1];
  const blocks: CanvasBlock[] = [];
  let title = 'Workspace Canvas';

  // Read title
  const titleMatch = yamlText.match(/title:\s*["']?([^"\n\r']+)["']?/);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Parse blocks manually from list items in YAML
  const lines = yamlText.split('\n');
  let currentBlock: any = null;
  let inBlocks = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('blocks:')) {
      inBlocks = true;
      continue;
    }

    if (inBlocks) {
      // If we hit another root key, stop parsing blocks
      if (line.search(/\S/) === 0 && trimmed !== '' && !trimmed.startsWith('-')) {
        inBlocks = false;
        continue;
      }

      if (trimmed.startsWith('-')) {
        if (currentBlock && currentBlock.type) {
          blocks.push(currentBlock);
        }
        currentBlock = { title: '', type: '', props: {} };
        // Check if there are inline fields, otherwise wait for next lines
        const typeMatch = trimmed.match(/type:\s*["']?([^"\n\r']+)["']?/);
        if (typeMatch) currentBlock.type = typeMatch[1];
      } else if (trimmed.startsWith('type:') && currentBlock) {
        currentBlock.type = trimmed.replace('type:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed.startsWith('title:') && currentBlock) {
        currentBlock.title = trimmed.replace('title:', '').trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed.startsWith('props:') && currentBlock) {
        const propsMatch = trimmed.match(/props:\s*({.+})/);
        if (propsMatch) {
          try {
            currentBlock.props = JSON.parse(propsMatch[1]);
          } catch (e) {
            console.warn('[parseCanvasMarkdown] Failed to parse props:', propsMatch[1], e);
          }
        }
      }
    }
  }

  if (currentBlock && currentBlock.type) {
    blocks.push(currentBlock);
  }

  return { title, blocks };
}

