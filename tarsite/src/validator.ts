/**
 * tarsite — Multi-Layer Validation Gate & Auto-Normalizer (Phase 5)
 * Structural (Zod) -> Referential (Registry) -> Data-Flow Type Gate.
 * Converts legacy section layouts automatically into versioned UIPlan AST objects.
 */

import { UIPlanSchema, type UIPlan, type UINode } from './types';
import { getPresetDesignTokens } from './tokens';

export const APPROVED_COMPONENTS = new Set([
  'announcement_bar',
  'header_nav',
  'hero_banner',
  'category_tiles',
  'product_grid',
  'perks_bar',
  'editorial_split',
  'activity_discovery',
  'service_list',
  'menu_grid',
  'feature_grid',
  'testimonials',
  'hours_card',
  'contact_form',
  'booking_form',
  'cart_widget',
  'footer',
]);

export const APPROVED_RESOURCES = new Set([
  'matter.product',
  'matter.menu_item',
  'matter.booking',
  'matter.contact',
]);

export const APPROVED_ACTIONS = new Set([
  'action_submit_contact',
  'action_submit_booking',
  'action_add_to_cart',
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  plan?: UIPlan;
}

/**
 * Strict check for plain JavaScript objects ({}) - excludes String objects, Arrays, and primitives
 */
function isPlainObject(val: any): boolean {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false;
  return Object.prototype.toString.call(val) === '[object Object]';
}

/**
 * Normalizes legacy section payloads into a clean UIPlan AST
 */
function normalizeToUIPlan(data: any): UIPlan | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data.layout || data.plan || data;
  if (!raw) return null;

  // 1. If it's already a valid UIPlan with routes
  if (Array.isArray(raw.routes) && raw.routes.length > 0) {
    return raw as UIPlan;
  }

  // 2. If it's a legacy layout with sections array
  const rawSections = Array.isArray(raw.sections)
    ? raw.sections
    : Array.isArray(raw.nodes)
    ? raw.nodes
    : [];

  if (rawSections.length === 0) return null;

  const presetStr = typeof raw.template === 'string' ? raw.template : (raw.theme?.preset || 'minimal-clean');
  const wsName = typeof raw.workspaceName === 'string' ? raw.workspaceName : (typeof raw.title === 'string' ? raw.title : 'Storefront');
  const tokens = getPresetDesignTokens(presetStr, wsName);

  const convertedNodes: UINode[] = rawSections.map((sec: any, idx: number) => {
    if (!sec || typeof sec !== 'object') {
      sec = { type: 'hero_banner', content: String(sec || '') };
    }

    let typeStr = String(sec.type || sec.name || 'hero_banner').toLowerCase().replace(/-/g, '_');
    if (typeStr === 'hero') typeStr = 'hero_banner';
    if (typeStr === 'products' || typeStr === 'product') typeStr = 'product_grid';
    if (typeStr === 'contact') typeStr = 'contact_form';
    if (typeStr === 'booking') typeStr = 'booking_form';
    if (typeStr === 'features') typeStr = 'feature_grid';

    if (!APPROVED_COMPONENTS.has(typeStr)) {
      typeStr = 'hero_banner';
    }

    // Always instantiate a fresh, plain JavaScript object
    const props: Record<string, any> = {};

    // Safely copy sec.props
    if (isPlainObject(sec.props)) {
      Object.assign(props, sec.props);
    } else if (sec.props != null) {
      props.subtitle = String(sec.props);
    }

    // Safely copy sec.config
    if (isPlainObject(sec.config)) {
      Object.assign(props, sec.config);
    } else if (sec.config != null) {
      props.subtitle = String(sec.config);
    }

    // Safely copy sec.content
    if (isPlainObject(sec.content)) {
      Object.assign(props, sec.content);
    } else if (sec.content != null) {
      const contentStr = String(sec.content);
      props.subtitle = props.subtitle || contentStr;
      props.text = props.text || contentStr;
    }

    // Ensure BOTH headline and title are set for hero/header components
    const bestHeadline = props.headline || props.title || sec.title || sec.headline || sec.name;
    if (bestHeadline != null) {
      const titleStr = String(bestHeadline);
      props.headline = titleStr;
      props.title = titleStr;
    }

    const bestSubtitle = props.subtitle || sec.subtitle || sec.description;
    if (bestSubtitle != null) {
      props.subtitle = String(bestSubtitle);
    }

    if (Array.isArray(sec.items)) {
      props.items = sec.items.map((item: any) => {
        if (isPlainObject(item)) return item;
        const itemStr = String(item || '');
        return { name: itemStr, title: itemStr, description: itemStr };
      });
    }

    return {
      id: String(sec.id || `node_${idx}_${Date.now()}`),
      type: typeStr as any,
      layout: String(sec.layout || sec.variant || 'split'),
      props,
    };
  });

  return {
    workspaceId: String(raw.workspaceId || 'default'),
    revision: String(raw.revision || `rev_${Date.now()}`),
    target: 'web',
    designTokens: tokens,
    routes: [
      {
        id: 'route_home',
        path: '/',
        title: 'Home',
        nodes: convertedNodes,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

export function validateUIPlanGate(data: unknown): ValidationResult {
  const errors: string[] = [];

  const normalized = normalizeToUIPlan(data);
  if (!normalized) {
    return { valid: false, errors: ['Could not parse or normalize layout payload'] };
  }

  // 1. Structural Validation (Zod)
  const parseResult = UIPlanSchema.safeParse(normalized);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`Structural [${issue.path.join('.')}]: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  const plan = parseResult.data;

  // 2. Referential & Data-Flow Validation
  for (const route of plan.routes) {
    const walk = (nodes: UINode[]) => {
      for (const node of nodes) {
        if (!APPROVED_COMPONENTS.has(node.type)) {
          errors.push(`Referential: Component type "${node.type}" is not in approved registry.`);
        }

        if (node.bindings) {
          for (const [key, binding] of Object.entries(node.bindings)) {
            if (!APPROVED_RESOURCES.has(binding.resource)) {
              errors.push(`Referential: Resource binding "${binding.resource}" for prop "${key}" is unapproved.`);
            }
          }
        }

        if (node.actions) {
          for (const [key, actionRef] of Object.entries(node.actions)) {
            if (!APPROVED_ACTIONS.has(actionRef.action)) {
              errors.push(`Referential: Action "${actionRef.action}" for event "${key}" is unapproved.`);
            }
          }
        }

        if (node.children) walk(node.children);
      }
    };

    walk(route.nodes);
  }

  return {
    valid: errors.length === 0,
    errors,
    plan: errors.length === 0 ? plan : undefined,
  };
}
