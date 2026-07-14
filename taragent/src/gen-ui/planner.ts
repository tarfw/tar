/**
 * UI Planner — generates SiteLayout from OKF context via LLM.
 * AI outputs structured JSON only; no executable code.
 */

import { getCatalogTypes } from './catalog';
import { getResourceIds } from './resources';
import { getActionIds } from './actions';
import { validateSiteLayout, flattenNodes, type SiteLayout, type PlannerContext } from './types';

// ── System prompt ───────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are a UI layout planner for the TAR platform.

Return exactly one JSON object matching the SiteLayout schema below.
No markdown. No explanation. No code fences. No executable content.

SCHEMA:
{
  "workspaceId": "string",
  "target": "native" | "web",
  "revision": "string (UUID format)",
  "routes": [{
    "id": "string (UUID format)",
    "path": "string (e.g. /, /catalog, /bookings)",
    "nodes": [{
      "id": "string (stable UUID, never changes between edits)",
      "type": "string (must be in SectionTypes)",
      "layout": "string (layout variant for this section type)",
      "props": {},
      "css": { "CSS property": "value" },
      "responsive": { "mobile": { "css": {} }, "tablet": { "css": {} } },
      "children": [nested nodes]
    }]
  }]
}

SECTION TYPES (use these for site target):
- hero_banner (layouts: centered, left-aligned, split, full-bleed)
- content_grid (layouts: 1-col, 2-col, 3-col, 4-col, sidebar-left, sidebar-right) — supports children
- product_grid (layouts: 2-col, 3-col, 4-col, carousel)
- service_list (layouts: cards, list, compact, featured)
- text_block (layouts: text-only, text-left-image-right, text-right-image-left, image-top)
- testimonial (layouts: single, carousel, grid, masonry)
- cta_button (layouts: centered, left, right, full-width)
- contact_form (layouts: centered, split, inline)
- map_embed (layouts: full-width, split, corner)
- faq_accordion (layouts: single-column, two-column, grouped)
- gallery (layouts: grid, masonry, carousel, single-row)
- pricing_table (layouts: 2-col, 3-col, comparison, simple-list)
- team_grid (layouts: grid, list, cards)
- footer (layouts: simple, multi-column, minimal)

CSS OVERRIDES (flat design — no shadows, no gradients, no transforms):
Every section accepts optional "css" object with CSS properties.
Every section accepts optional "responsive" object with mobile (<768px) and tablet (769-1024px) overrides.

DESIGN RULES (hard slop = error, must regenerate):
- No box-shadow, linear-gradient, radial-gradient, text-shadow, filter:drop-shadow
- No transform:translateY on hover (use border/color change)
- No position:fixed (breaks mobile)
- No emoji in headings
- No placeholder images (data URIs, SVG placeholders, solid color blocks)
- No placeholder text (lorem ipsum, click here, coming soon)
- No cliché headlines (best in town, welcome to, number one)
- Max 2 CTAs per section
- Max 4 grid columns
- Max 6 sections per page
- zIndex max 100
- height max 100vh
- opacity min 0.3

RULES:
- Use only section types listed above.
- Use only resources from the ResourceCatalog.
- Use only actions from the ActionCatalog.
- Never write JS, JSX, HTML, CSS, SQL, or functions.
- Never inline live data — use resource bindings.
- Preserve existing node IDs when updating a plan.
- Accessibility requirements override all visual preferences.
- If a requirement cannot be met with available components, omit it.
- Make the smallest change that achieves the goal.
- Content stands on its own — no floating boxes around small text elements.

PERSONALIZATION (apply top-down):
  authorization → accessibility → workspace policy → user preference → default

BEFORE RETURNING, verify:
- every type is a valid section type
- every resource and action is approved
- all node IDs are unique
- no executable content present
- no shadow/gradient/transform properties in css objects
- no placeholder images or text

Return only the SiteLayout JSON.`;

// ── Build user prompt from context ──────────────────────────────────

function buildUserPrompt(ctx: PlannerContext): string {
  const catalogTypes = getCatalogTypes().join(', ');
  const resourceIds = getResourceIds().join(', ');
  const actionIds = getActionIds().join(', ');

  let prompt = `Target: "${ctx.target}"
Available modules: ${ctx.availableModules.join(', ')}

COMPONENT CATALOG (types allowed):
${catalogTypes}

RESOURCE CATALOG (bindings allowed):
${resourceIds}

ACTION CATALOG (actions allowed):
${actionIds}

DESIGN TOKENS:
${JSON.stringify(ctx.designTokens, null, 2)}
`;

  if (ctx.memory) {
    prompt += `
USER PREFERENCES:
- Role: ${ctx.memory.role}
- Density: ${ctx.memory.density}
- Accessibility: reducedMotion=${ctx.memory.accessibility.reducedMotion}, largeText=${ctx.memory.accessibility.largeText}
- Excluded variants: ${ctx.memory.excludedVariants.join(', ') || 'none'}
`;
  }

  if (ctx.currentPlan) {
    prompt += `
EXISTING PLAN (update this, preserve node IDs):
${JSON.stringify(ctx.currentPlan, null, 2)}
`;
  }

  if (ctx.instruction) {
    prompt += `
INSTRUCTION: "${ctx.instruction}"
`;
  }

  prompt += `
Return the SiteLayout JSON with workspaceId="${ctx.workspaceId}" and target="${ctx.target}".`;

  return prompt;
}

// ── Call LLM ────────────────────────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  env: any
): Promise<string> {
  // Primary: Cloudflare Workers AI — Z.AI GLM-4.7-Flash (free)
  const cfAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = env.CLOUDFLARE_API_TOKEN;

  if (cfAccountId && cfApiToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/zai-org/glm-4.7-flash`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 4000,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json() as any;
        const content = data?.result?.response || data?.result?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err) {
      console.warn('[planner] Workers AI failed, falling back to Groq:', err);
    }
  }

  // Fallback: Groq — LLaMA 3.3 70B
  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) throw new Error('No LLM API configured (need CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN or GROQ_API_KEY)');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return content;
}

// ── Parse LLM output ────────────────────────────────────────────────

function parseLLMOutput(raw: string): unknown {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in LLM output');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

// ── Main planner function ───────────────────────────────────────────

export async function generatePlan(
  ctx: PlannerContext,
  env: any
): Promise<{ plan: SiteLayout | null; error?: string }> {
  try {
    const userPrompt = buildUserPrompt(ctx);
    const raw = await callLLM(PLANNER_SYSTEM_PROMPT, userPrompt, env);
    const parsed = parseLLMOutput(raw);

    const plan = validateSiteLayout(parsed);
    if (!plan) {
      return { plan: null, error: 'Invalid plan schema' };
    }

    // Ensure workspaceId and target match context
    plan.workspaceId = ctx.workspaceId;
    plan.target = ctx.target;

    return { plan };
  } catch (err: any) {
    return { plan: null, error: err.message || 'Planner failed' };
  }
}
