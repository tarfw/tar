/**
 * tarsite — Single-Pass Design.md Frontmatter & Sections Parser
 * Converts Markdown `design.md` files into versioned UIPlan Blueprint objects.
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
 * Robust zero-dependency YAML parser for Design.md frontmatter & sections manifest
 */
export function parseYamlContent(yamlStr: string): Record<string, any> {
  const lines = yamlStr.split(/\r?\n/);
  const root: Record<string, any> = {};

  const stack: { indent: number; obj: any }[] = [{ indent: -1, obj: root }];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;

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
        let val: any;
        if (valStr.startsWith('{') && valStr.endsWith('}')) {
          try {
            const inner = valStr.slice(1, -1);
            const obj: Record<string, any> = {};
            inner.split(',').forEach((part) => {
              const [k, v] = part.split(':');
              if (k && v) obj[k.trim()] = parseVal(v.trim());
            });
            val = obj;
          } catch {
            val = parseVal(valStr);
          }
        } else if (valStr.startsWith('[') && valStr.endsWith(']')) {
          try {
            val = valStr.slice(1, -1).split(',').map((s) => parseVal(s.trim()));
          } catch {
            val = parseVal(valStr);
          }
        } else {
          val = parseVal(valStr);
        }

        if (Array.isArray(currentContainer)) {
          const last = currentContainer[currentContainer.length - 1];
          if (last && typeof last === 'object') {
            last[key] = val;
          }
        } else {
          currentContainer[key] = val;
        }
      } else {
        let isArray = false;
        for (let j = idx + 1; j < lines.length; j++) {
          const nextTrim = lines[j].trim();
          if (!nextTrim || nextTrim.startsWith('#') || nextTrim.startsWith('```')) continue;
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
 * Parses frontmatter block cleanly by finding exact opening and closing `---`
 */
export function parseFrontmatter(mdContent: string): { data: Record<string, any>; body: string } {
  const trimmed = mdContent.trim();
  if (trimmed.startsWith('---')) {
    const endFence = trimmed.indexOf('\n---', 3);
    if (endFence !== -1) {
      const yamlStr = trimmed.slice(3, endFence).trim();
      const body = trimmed.slice(endFence + 4).trim();
      const data = parseYamlContent(yamlStr);
      return { data, body };
    }
  }

  return { data: {}, body: mdContent };
}

/**
 * Convert design.md Markdown text into Site Blueprint (UIPlan)
 */
export function parseDesignMd(mdContent: string, workspaceId = 'default'): UIPlan {
  const { data, body } = parseFrontmatter(mdContent);

  // Extract preset hint from template or preset_name
  const presetHint = (data.template || data.preset_name || data.preset || '').toLowerCase();

  // 1. Parse tokens
  let designTokens: DesignTokens = PRESET_TOKENS[presetHint] || parseDesignMarkdown(mdContent, presetHint);

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

  // A. Check for routes object in frontmatter
  if (data.routes && typeof data.routes === 'object') {
    for (const [path, routeDef] of Object.entries<any>(data.routes)) {
      const nodes: UINode[] = [];
      const sectionList = Array.isArray(routeDef.sections) ? routeDef.sections : [];

      sectionList.forEach((s: any, idx: number) => {
        nodes.push({
          id: s.id || `node_${idx}`,
          type: s.type || 'product_grid',
          variant: s.variant,
          contract: s.contract || s.style || {},
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

  // B. Check for sections list in frontmatter (data.sections)
  if (routes.length === 0 && Array.isArray(data.sections) && data.sections.length > 0) {
    const nodes: UINode[] = data.sections.map((s: any, idx: number) => ({
      id: s.id || `node_${idx}`,
      type: s.type || 'product_grid',
      variant: s.variant,
      contract: s.contract || s.style || {},
      props: s.props || {},
    }));

    routes.push({
      id: 'route_home',
      path: '/',
      title: designTokens.name || 'Storefront',
      nodes,
    });
  }

  // C. Check for sections manifest inside markdown body (e.g. ## Sections Manifest ```yaml ... ```)
  if (routes.length === 0) {
    const searchTarget = body || mdContent;
    const manifestMatch = searchTarget.match(/##\s*Sections Manifest[\s\S]*?```(?:yaml)?([\s\S]*?)```/i);
    if (manifestMatch) {
      const manifestYaml = manifestMatch[1];
      const parsedManifest = parseYamlContent(manifestYaml);
      const sectionList = Array.isArray(parsedManifest.sections) ? parsedManifest.sections : [];

      if (sectionList.length > 0) {
        const nodes: UINode[] = sectionList.map((s: any, idx: number) => ({
          id: s.id || `node_${idx}`,
          type: s.type || 'product_grid',
          variant: s.variant,
          contract: s.contract || s.style || {},
          props: s.props || {},
        }));

        routes.push({
          id: 'route_home',
          path: '/',
          title: designTokens.name || 'Storefront',
          nodes,
        });
      }
    }
  }

  // D. Fallback default sections if nothing was found
  if (routes.length === 0) {
    routes.push({
      id: 'route_home',
      path: '/',
      title: designTokens.name || 'Storefront',
      nodes: [
        { id: 'n1', type: 'announcement_bar', props: { text: 'Free Express Shipping Nationwide' } },
        { id: 'n2', type: 'header_nav', props: { brand_name: designTokens.name } },
        { id: 'n3', type: 'hero_banner', props: { headline: designTokens.name } },
        { id: 'n4', type: 'product_grid', props: { title: 'Featured Collection' } },
        { id: 'n5', type: 'footer_strip', variant: 'footer', props: { text: `© 2026 ${designTokens.name}` } },
      ],
    });
  }

  return {
    workspaceId,
    revision: 'design-v1',
    target: 'web',
    designTokens,
    routes,
    createdAt: new Date().toISOString(),
  };
}

export const parseOkfDesign = parseDesignMd;
