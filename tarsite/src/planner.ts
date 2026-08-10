/**
 * tarsite — Staged Multi-Agent Generator (Phase 4)
 * Orchestrates Structural Architecture and Page Fragment Compilers.
 * Outputs validated UIPlan objects with support for Qwen 2.5 Coder 32B, Qwen 2.5 72B, DeepSeek & Llama models.
 */

import { getSkillForIntent } from './skill-manifest';
import { validateUIPlan, type UIPlan, type UIRoute, type UINode, type DesignTokens } from './types';
import { getPresetDesignTokens } from './tokens';

export interface PlannerOptions {
  workspaceId: string;
  workspaceName: string;
  instruction: string;
  templateHint?: string;
  model?: string;
  groqApiKey?: string;
  products?: Array<{ name: string; price?: number | null; description?: string }>;
}

export const SUPPORTED_MODELS = [
  'qwen/qwen3.6-27b',
  'llama-3.3-70b-versatile',
  'deepseek-r1-distill-llama-70b',
];

/**
 * Groq LLM API Completion Caller
 */
async function callGroqLLM(options: PlannerOptions): Promise<any | null> {
  const apiKey = options.groqApiKey;
  if (!apiKey) return null;

  const model = options.model || 'qwen/qwen3.6-27b';

  const systemPrompt = `You are a Principal UI/UX Architect compiling a versioned UIPlan AST for a Webflow-standard web layout.
Respond strictly with valid JSON conforming to this schema:
{
  "template": "notion | lululemon | luxury-black | minimal-clean",
  "routes": [
    {
      "id": "route_home",
      "path": "/",
      "title": "Home",
      "nodes": [
        { "id": "node_announcement", "type": "announcement_bar", "props": { "text": "..." } },
        { "id": "node_hero", "type": "hero_banner", "layout": "split", "props": { "headline": "...", "subtitle": "...", "ctaText": "..." } },
        { "id": "node_products", "type": "product_grid", "layout": "grid-3", "props": { "title": "..." } },
        { "id": "node_contact", "type": "contact_form", "props": { "title": "Get in touch" }, "actions": { "submit": { "action": "action_submit_contact" } } },
        { "id": "node_footer", "type": "footer", "props": { "text": "..." } }
      ]
    }
  ]
}`;

  const userPrompt = `Workspace: "${options.workspaceName}"
Instruction: "${options.instruction}"
Template Hint: "${options.templateHint || 'minimal-clean'}"
Products: ${JSON.stringify(options.products || [])}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.warn(`[Planner] Groq API returned ${res.status}:`, await res.text().catch(() => ''));
      return null;
    }

    const data: any = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    return JSON.parse(rawContent);
  } catch (err) {
    console.warn('[Planner] Groq LLM call failed:', err);
    return null;
  }
}

/**
 * Fallback Structural Orchestrator — Builds Information Architecture (IA) & Routes
 */
function orchestrateIA(options: PlannerOptions): UIRoute[] {
  const { workspaceName, instruction, templateHint, products = [] } = options;

  const homeNodes: UINode[] = [
    {
      id: 'node_announcement',
      type: 'announcement_bar',
      props: { text: `Welcome to ${workspaceName} · Discover our offerings` },
    },
    {
      id: 'node_hero',
      type: 'hero_banner',
      layout: 'split',
      props: {
        badge: 'Official Storefront',
        headline: instruction ? instruction.slice(0, 60) : `Welcome to ${workspaceName}`,
        subtitle: 'Engineered for exceptional performance and modern design standards.',
        ctaText: 'Explore Collection',
        ctaUrl: '/catalog',
        secondaryCtaText: 'Contact Us',
        secondaryCtaUrl: '#contact',
      },
    },
    {
      id: 'node_products',
      type: 'product_grid',
      layout: 'grid-3',
      props: {
        title: 'Featured Offerings',
        subtitle: 'Handcrafted items available for immediate order',
        items: products.length > 0 ? products : [
          { name: 'Edition 01 — Standard', price: 190, description: 'High reliability core release.' },
          { name: 'Edition 02 — Professional', price: 390, description: 'Advanced features built for power usage.' },
          { name: 'Edition 03 — Enterprise', price: 790, description: 'Full capability suite with priority support.' },
        ],
      },
      bindings: {
        items: { resource: 'matter.product', transform: 'array' },
      },
    },
    {
      id: 'node_testimonials',
      type: 'testimonials',
      layout: 'grid-2',
      props: {
        title: 'Client Reviews',
        subtitle: 'Trusted by industry leaders worldwide',
        items: [
          { quote: 'Seamless integration and gorgeous aesthetic. A game changer.', author: 'Alex Morgan', role: 'Product Lead' },
          { quote: 'Fast, responsive, and reliable. Highly recommended.', author: 'Sarah Chen', role: 'Founder & CEO' },
        ],
      },
    },
    {
      id: 'node_contact',
      type: 'contact_form',
      props: {
        title: 'Get In Touch',
        subtitle: 'Have questions? We respond within 24 hours.',
        submitLabel: 'Send Message',
      },
      actions: {
        submit: { action: 'action_submit_contact' },
      },
    },
    {
      id: 'node_footer',
      type: 'footer',
      props: {
        text: `© ${new Date().getFullYear()} ${workspaceName}. All rights reserved. Powered by TAR.`,
      },
    },
  ];

  const catalogNodes: UINode[] = [
    {
      id: 'node_cat_hero',
      type: 'hero_banner',
      props: { headline: 'Complete Catalog', subtitle: `Browse all items available at ${workspaceName}` },
    },
    {
      id: 'node_cat_grid',
      type: 'product_grid',
      layout: 'grid-4',
      props: { title: 'All Items', items: products },
      bindings: { items: { resource: 'matter.product', transform: 'array' } },
    },
    {
      id: 'node_cat_footer',
      type: 'footer',
      props: { text: `© ${new Date().getFullYear()} ${workspaceName}.` },
    },
  ];

  return [
    { id: 'route_home', path: '/', title: 'Home', nodes: homeNodes },
    { id: 'route_catalog', path: '/catalog', title: 'Catalog', nodes: catalogNodes },
  ];
}

/**
 * Main UIPlan Compiler Pipeline
 */
export async function compileUIPlan(options: PlannerOptions): Promise<{ plan: UIPlan | null; error?: string }> {
  try {
    // 1. Try Groq API call with selected model (Qwen 2.5 Coder 32B, Qwen 72B, DeepSeek R1, Llama 3.3)
    const aiOutput = await callGroqLLM(options);

    const presetName = aiOutput?.template || options.templateHint || 'minimal-clean';
    const tokens: DesignTokens = getPresetDesignTokens(presetName, options.workspaceName);

    const routes: UIRoute[] = (aiOutput?.routes && Array.isArray(aiOutput.routes) && aiOutput.routes.length > 0)
      ? aiOutput.routes
      : orchestrateIA(options);

    const rawPlan: UIPlan = {
      workspaceId: options.workspaceId,
      revision: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      target: 'web',
      designTokens: tokens,
      routes,
      createdAt: new Date().toISOString(),
    };

    const validated = validateUIPlan(rawPlan);
    if (!validated) {
      return { plan: null, error: 'Generated plan failed Zod validation contract' };
    }

    return { plan: validated };
  } catch (err: any) {
    return { plan: null, error: err?.message || 'UIPlan compilation failed' };
  }
}
