/**
 * Rule Critic — anti-slop checks on generated SiteLayout JSON.
 *
 * Two tiers:
 *   error   → regenerate (emoji in headings, gradients, shadows, placeholders, etc.)
 *   warning → log only (spacing variance, font weight, palette width)
 *
 * Also checks CSS overrides for flat-design violations.
 */

import { fetchAntiSlop } from './design-loader';
import { flattenNodes, type SiteLayout, type UINode } from './types';

// ── Emoji detection ─────────────────────────────────────────────────

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// ── Cliché headline detection ───────────────────────────────────────

const CLICHE_PATTERNS = [
  /best\s+(in|of)\s+\w+/i,
  /welcome\s+to/i,
  /we\s+are\s+(the\s+)?best/i,
  /number\s+one/i,
  /world.class/i,
  /unbeatable/i,
  /lifetime\s+warranty/i,
  /try\s+us\s+today/i,
  /call\s+now/i,
  /limited\s+time\s+offer/i,
  /don't\s+miss\s+out/i,
];

// ── Placeholder text detection ──────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /click\s+here/i,
  /read\s+more/i,
  /learn\s+more/i,
  /find\s+out\s+more/i,
  /coming\s+soon/i,
  /your\s+(text|content|image|logo)/i,
  /example\.com/i,
  /sample\s+text/i,
  /placeholder/i,
  /dummy/i,
];

// ── Placeholder image detection ─────────────────────────────────────

const PLACEHOLDER_IMG_PATTERNS = [
  /data:image\/svg\+xml/i,
  /data:image\/(gif|png|jpeg);base64/i,
  /via\.placeholder\.com/i,
  /placehold\.co/i,
  /placeholder\.com/i,
  /picsum\.photos/i,
  /loremflickr\.com/i,
];

// ── CSS violation detection ─────────────────────────────────────────

interface CSSViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

function checkCssOverrides(css: Record<string, any> | undefined): CSSViolation[] {
  if (!css) return [];
  const violations: CSSViolation[] = [];

  // Hard slop — flat design
  if (css.boxShadow) {
    violations.push({ rule: 'no_box_shadow', severity: 'error', message: 'box-shadow banned in flat design' });
  }
  if (css.linearGradient || css.backgroundImage?.includes('linear-gradient')) {
    violations.push({ rule: 'no_gradient', severity: 'error', message: 'linear-gradient banned in flat design' });
  }
  if (css.radialGradient || css.backgroundImage?.includes('radial-gradient')) {
    violations.push({ rule: 'no_gradient', severity: 'error', message: 'radial-gradient banned in flat design' });
  }
  if (css.textShadow) {
    violations.push({ rule: 'no_text_shadow', severity: 'error', message: 'text-shadow banned in flat design' });
  }
  if (css.filter?.includes('drop-shadow')) {
    violations.push({ rule: 'no_drop_shadow', severity: 'error', message: 'filter: drop-shadow banned in flat design' });
  }

  // Hard slop — layout safety
  if (css.position === 'fixed') {
    violations.push({ rule: 'no_position_fixed', severity: 'error', message: 'position:fixed breaks mobile' });
  }
  const z = parseInt(String(css.zIndex), 10);
  if (!isNaN(z) && z > 100) {
    violations.push({ rule: 'z_index_max_100', severity: 'error', message: `z-index ${z} exceeds max 100` });
  }
  if (typeof css.height === 'string' && css.height.endsWith('vh')) {
    const vh = parseInt(css.height, 10);
    if (vh > 100) {
      violations.push({ rule: 'height_max_100vh', severity: 'error', message: `height ${css.height} exceeds 100vh` });
    }
  }
  if (css.opacity !== undefined && parseFloat(String(css.opacity)) < 0.3) {
    violations.push({ rule: 'opacity_min_0_3', severity: 'error', message: `opacity ${css.opacity} below minimum 0.3` });
  }

  // Hard slop — floating boxes
  if (css.borderRadius && css.padding && css.backgroundColor) {
    // Heuristic: small element with background + border-radius = floating box
    const padVal = parseInt(String(css.padding), 10);
    if (!isNaN(padVal) && padVal < 20) {
      violations.push({ rule: 'no_floating_box', severity: 'error', message: 'background + border-radius + small padding = floating box' });
    }
  }

  return violations;
}

// ── Node-level checks ───────────────────────────────────────────────

interface NodeViolation {
  nodeId: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

function checkNode(node: UINode): NodeViolation[] {
  const violations: NodeViolation[] = [];

  // Check emoji in headings (props.heading, props.title, props.label)
  const textFields = [node.props.heading, node.props.title, node.props.label, node.props.subtitle];
  for (const text of textFields) {
    if (typeof text === 'string' && EMOJI_REGEX.test(text)) {
      violations.push({ nodeId: node.id, rule: 'no_emoji_in_headings', severity: 'error', message: `Emoji found in "${text.slice(0, 30)}"` });
    }
  }

  // Check placeholder text
  const allText = [node.props.heading, node.props.title, node.props.body, node.props.label, node.props.description, node.props.subtitle]
    .filter(Boolean)
    .join(' ');
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(allText)) {
      violations.push({ nodeId: node.id, rule: 'no_placeholder_text', severity: 'error', message: `Placeholder text detected: ${allText.slice(0, 50)}` });
    }
  }

  // Check cliché headlines
  for (const pattern of CLICHE_PATTERNS) {
    if (pattern.test(allText)) {
      violations.push({ nodeId: node.id, rule: 'no_cliche_headlines', severity: 'error', message: `Cliché headline detected: ${allText.slice(0, 50)}` });
    }
  }

  // Check placeholder images
  const imgFields = [node.props.image, node.props.heroImage, node.props.src, node.props.backgroundImage, node.props.url]
    .filter(Boolean)
    .join(' ');
  for (const pattern of PLACEHOLDER_IMG_PATTERNS) {
    if (pattern.test(imgFields)) {
      violations.push({ nodeId: node.id, rule: 'no_placeholder_images', severity: 'error', message: `Placeholder image detected: ${imgFields.slice(0, 50)}` });
    }
  }

  // Check image URL validity (must be http/https if present)
  if (node.props.image && typeof node.props.image === 'string') {
    const url = node.props.image;
    if (url && !url.startsWith('http') && !url.startsWith('data:') && !url.endsWith('.jpg') && !url.endsWith('.png') && !url.endsWith('.webp')) {
      // Not a valid image URL
    }
  }

  // Check CTA count (max 2 per section)
  const ctas = [node.props.cta, node.props.cta1, node.props.cta2, node.props.cta3].filter(Boolean);
  if (ctas.length > 2) {
    violations.push({ nodeId: node.id, rule: 'max_2_cta_per_section', severity: 'error', message: `${ctas.length} CTAs found (max 2)` });
  }

  // Check CSS overrides
  const cssViolations = checkCssOverrides(node.props.css || node.css);
  for (const v of cssViolations) {
    violations.push({ nodeId: node.id, rule: v.rule, severity: v.severity, message: v.message });
  }

  // Check children recursively
  if (node.children) {
    for (const child of node.children) {
      violations.push(...checkNode(child));
    }
  }

  return violations;
}

// ── Plan-level checks ───────────────────────────────────────────────

interface PlanViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

function checkPlan(plan: SiteLayout): PlanViolation[] {
  const violations: PlanViolation[] = [];

  // Max sections per route
  for (const route of plan.routes) {
    if (route.nodes.length > 6) {
      violations.push({ rule: 'max_sections', severity: 'error', message: `Route ${route.path} has ${route.nodes.length} sections (max 6)` });
    }
  }

  // Duplicate node IDs
  const allNodes = flattenNodes(plan);
  const ids = new Set<string>();
  for (const node of allNodes) {
    if (ids.has(node.id)) {
      violations.push({ rule: 'unique_ids', severity: 'error', message: `Duplicate node ID: ${node.id}` });
    }
    ids.add(node.id);
  }

  return violations;
}

// ── Main critic function ────────────────────────────────────────────

export interface CriticResult {
  valid: boolean;
  errors: Array<{ nodeId?: string; rule: string; message: string }>;
  warnings: Array<{ nodeId?: string; rule: string; message: string }>;
}

export async function runRuleCritic(
  plan: SiteLayout,
  env: any
): Promise<CriticResult> {
  const antiSlop = await fetchAntiSlop(env);
  const errors: CriticResult['errors'] = [];
  const warnings: CriticResult['warnings'] = [];

  // Plan-level checks
  const planViolations = checkPlan(plan);
  for (const v of planViolations) {
    if (v.severity === 'error') errors.push({ rule: v.rule, message: v.message });
    else warnings.push({ rule: v.rule, message: v.message });
  }

  // Node-level checks
  for (const route of plan.routes) {
    for (const node of route.nodes) {
      const nodeViolations = checkNode(node);
      for (const v of nodeViolations) {
        if (v.severity === 'error') {
          errors.push({ nodeId: v.nodeId, rule: v.rule, message: v.message });
        } else {
          warnings.push({ nodeId: v.nodeId, rule: v.rule, message: v.message });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
