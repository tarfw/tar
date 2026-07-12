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
      "type": "string (must be in ComponentCatalog)",
      "variant": "string (optional)",
      "props": {},
      "bindings": { "key": { "resource": "resource.id" } },
      "actions": { "key": { "action": "action.id" } },
      "children": [nested nodes]
    }]
  }]
}

RULES:
- Use only types present in the ComponentCatalog for this target.
- Use only resources from the ResourceCatalog.
- Use only actions from the ActionCatalog.
- Never write JS, JSX, HTML, CSS, SQL, or functions.
- Never inline live data — use resource bindings.
- Preserve existing node IDs when updating a plan.
- Accessibility requirements override all visual preferences.
- If a requirement cannot be met with available components, omit it.
- Make the smallest change that achieves the goal.

PERSONALIZATION (apply top-down):
  authorization → accessibility → workspace policy → user preference → default

BEFORE RETURNING, verify:
- every type exists in catalog
- every resource and action is approved
- all node IDs are unique
- no executable content present

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
  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not configured');

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
