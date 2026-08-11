/**
 * tarsite — Single-Pass OKF Markdown/YAML Frontmatter Parser
 * Converts OKF `design.md` files into versioned UIPlan AST objects with Section Contracts.
 */

import { type UIPlan, type UIRoute, type UINode, type DesignTokens } from './types';
import { parseDesignMarkdown, PRESET_TOKENS } from './tokens';

function parseVal(v: string): any {
  if (!v) return '';
  v = v.trim().replace(/^["']|["']$/g, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (!isNaN(Number(v)) && v !== '') return Number(v);
  return v;
}

/**
 * Lightweight, zero-dependency YAML parser for OKF frontmatter with indentation support
 */
export function parseYamlContent(yamlStr: string): Record<string, any> {
  const lines = yamlStr.split('\n');
  const root: Record<string, any> = {};

  const stack: { indent: number; obj: any }[] = [{ indent: -1, obj: root }];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.search(/\S/);

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentContainer = stack[stack.length - 1].obj;

    if (trimmed.startsWith('- ')) {
      const itemStr = trimmed.slice(2).trim();
      if (!Array.isArray(currentContainer)) continue;

      const colonIdx = itemStr.indexOf(':');
      if (colonIdx !== -1) {
        const k = itemStr.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
        const v = itemStr.slice(colonIdx + 1).trim();
        const itemObj: Record<string, any> = {};
        if (v) {
          itemObj[k] = parseVal(v);
        }
        currentContainer.push(itemObj);
        stack.push({ indent, obj: itemObj });
      } else {
        currentContainer.push(parseVal(itemStr));
      }
    } else if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
      const valStr = trimmed.slice(colonIdx + 1).trim();

      if (valStr) {
        const val = parseVal(valStr);
        if (Array.isArray(currentContainer)) {
          const last = currentContainer[currentContainer.length - 1];
          if (last && typeof last === 'object') {
            last[key] = val;
          }
        } else {
          currentContainer[key] = val;
        }
      } else {
        // Look ahead to check if next non-empty line starts with `- `
        let isArray = false;
        for (let j = idx + 1; j < lines.length; j++) {
          const nextTrim = lines[j].trim();
          if (!nextTrim || nextTrim.startsWith('#')) continue;
          if (nextTrim.startsWith('- ')) isArray = true;
          break;
        }

        const newChild = isArray ? [] : {};
        if (Array.isArray(currentContainer)) {
          const last = currentContainer[currentContainer.length - 1];
          if (last && typeof last === 'object') {
            last[key] = newChild;
            stack.push({ indent, obj: newChild });
          }
        } else {
          currentContainer[key] = newChild;
          stack.push({ indent, obj: newChild });
        }
      }
    }
  }

  return root;
}

/**
 * Parses OKF frontmatter block from `design.md` text
 */
export function parseFrontmatter(mdContent: string): { data: Record<string, any>; body: string } {
  const match = mdContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) {
    return { data: {}, body: mdContent };
  }

  const yamlStr = match[1];
  const body = match[2] || '';
  const data = parseYamlContent(yamlStr);

  return { data, body };
}

/**
 * Convert OKF design.md into UIPlan AST
 */
export function parseOkfDesign(mdContent: string, workspaceId = 'default'): UIPlan {
  const { data } = parseFrontmatter(mdContent);

  // 1. Parse tokens
  let designTokens: DesignTokens = PRESET_TOKENS[data.preset_name || data.preset] || parseDesignMarkdown(mdContent, data.preset);

  if (data.tokens && typeof data.tokens === 'object') {
    designTokens = {
      ...designTokens,
      colors: {
        ...designTokens.colors,
        ...(data.tokens.color_primary ? { primary: data.tokens.color_primary } : {}),
        ...(data.tokens.color_bg ? { background: data.tokens.color_bg } : {}),
        ...(data.tokens.color_surface ? { surface: data.tokens.color_surface } : {}),
        ...(data.tokens.color_accent ? { tertiary: data.tokens.color_accent } : {}),
        ...(data.tokens.color_text ? { text: data.tokens.color_text } : {}),
      },
    };
  }

  // 2. Parse Routes & Section Nodes
  const routes: UIRoute[] = [];

  if (data.routes && typeof data.routes === 'object') {
    for (const [path, routeDef] of Object.entries<any>(data.routes)) {
      const nodes: UINode[] = [];
      const sectionList = Array.isArray(routeDef.sections) ? routeDef.sections : [];

      sectionList.forEach((s: any, idx: number) => {
        nodes.push({
          id: `okf_node_${idx}`,
          type: s.type || 'content_grid',
          variant: s.variant,
          contract: s.contract || {},
          props: s.props || {},
        });
      });

      routes.push({
        id: `route_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        path,
        title: routeDef.title || 'Home',
        nodes,
      });
    }
  }

  // Default fallback route if no route section was provided in frontmatter
  if (routes.length === 0) {
    routes.push({
      id: 'route_home',
      path: '/',
      title: designTokens.name || 'Storefront',
      nodes: [
        { id: 'n1', type: 'marquee_strip', props: { text: 'Free Express Shipping Nationwide' } },
        { id: 'n2', type: 'navigation_bar', props: { brand_name: designTokens.name } },
        { id: 'n3', type: 'media_hero', props: { headline: designTokens.name } },
        { id: 'n4', type: 'content_grid', props: { title: 'Featured Collection' } },
        { id: 'n5', type: 'action_strip', variant: 'footer', props: { text: `© 2026 ${designTokens.name}` } },
      ],
    });
  }

  return {
    workspaceId,
    revision: 'okf-v1',
    target: 'web',
    designTokens,
    routes,
    createdAt: new Date().toISOString(),
  };
}
