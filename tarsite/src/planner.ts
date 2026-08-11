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
  "template": "notion | lululemon | luxury-black | minimal-clean | aesop | kith",
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

  if (templateHint === 'kith' || instruction?.toLowerCase().includes('kith') || instruction?.toLowerCase().includes('streetwear')) {
    const wsUpper = (workspaceName || 'KITH').toUpperCase();
    const kithNodes: UINode[] = [
      {
        id: 'node_announcement',
        type: 'announcement_bar',
        props: { text: `FREE SHIPPING ON ORDERS OVER $150  |  EASY RETURNS  |  ${wsUpper} DROP LIVE NOW` },
      },
      {
        id: 'node_header',
        type: 'header_nav',
        props: { title: wsUpper }
      },
      {
        id: 'node_hero_carousel',
        type: 'hero_carousel',
        props: {
          items: [
            { title: `${wsUpper}\nSummer 2026`, subtitle: 'New Delivery', ctaText: 'Shop Now', image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1920&h=960&fit=crop' },
            { title: 'City\nClassics', subtitle: 'Monochrome', ctaText: 'Explore', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=960&fit=crop' },
            { title: 'Womens\nCollection', subtitle: 'New Season', ctaText: 'Shop Womens', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1920&h=960&fit=crop' },
            { title: `${wsUpper} x\nAdidas`, subtitle: 'Collaborations', ctaText: 'View Collection', image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1920&h=960&fit=crop&sat=-100' },
          ]
        }
      },
      {
        id: 'node_section_hero_summer',
        type: 'section_hero',
        props: {
          subtitle: 'New Delivery',
          headline: `${wsUpper} Summer\nCollection`,
          image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1920&h=960&fit=crop',
          buttons: [{ text: 'Mens', url: '#products' }, { text: 'Womens', url: '#products' }]
        }
      },
      {
        id: 'node_lookbook_1',
        type: 'lookbook_grid',
        props: {
          images: [
            'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop'
          ]
        }
      },
      {
        id: 'node_section_hero_kin',
        type: 'section_hero',
        props: {
          subtitle: 'Lifestyle',
          headline: `&Kin ${wsUpper}\n2026`,
          image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1920&h=960&fit=crop',
          buttons: [{ text: 'Shop Lifestyle', url: '#products' }]
        }
      },
      {
        id: 'node_lookbook_2',
        type: 'lookbook_grid',
        props: {
          images: [
            'https://images.unsplash.com/photo-1434389677669-e08b4cda3a23?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=800&fit=crop',
            'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop'
          ]
        }
      },
      {
        id: 'node_products_kith',
        type: 'product_grid',
        layout: 'grid-4',
        props: {
          title: 'Featured Collection',
          subtitle: `New drops & ${wsUpper} classics`,
          items: products.length > 0 ? products : [
            { name: `${wsUpper} Classic Logo Tee`, brand: wsUpper, price: 95, badge: 'New', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Heavyweight Hoodie`, brand: wsUpper, price: 195, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Coach Jacket`, brand: wsUpper, price: 245, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Crewneck`, brand: wsUpper, price: 165, badge: 'Sold Out', image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Cargo Pant`, brand: wsUpper, price: 225, badge: 'New', image: 'https://images.unsplash.com/photo-1434389677669-e08b4cda3a23?w=600&h=800&fit=crop' },
            { name: `${wsUpper} x Adidas Samba`, brand: `${wsUpper} x Adidas`, price: 180, image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Half Zip Pullover`, brand: wsUpper, price: 175, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop' },
            { name: `${wsUpper} Linen Short`, brand: wsUpper, price: 95, comparePrice: 135, image: 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=600&h=800&fit=crop' },
          ]
        }
      },
      {
        id: 'node_newsletter',
        type: 'newsletter',
        props: {
          title: 'Join Our List',
          subtitle: 'Sign up for exclusive access to new releases, sales, and more.'
        }
      },
      {
        id: 'node_footer',
        type: 'footer',
        props: {
          text: `© ${new Date().getFullYear()} ${wsUpper} RETAIL LLC. ALL RIGHTS RESERVED.`
        }
      }
    ];

    return [
      { id: 'route_home', path: '/', title: 'Home', nodes: kithNodes },
      { id: 'route_catalog', path: '/catalog', title: 'Catalog', nodes: kithNodes },
    ];
  }

  if (templateHint === 'milo' || instruction?.toLowerCase().includes('milo') || instruction?.toLowerCase().includes('pet')) {
    const wsUpper = (workspaceName || 'MILO').toUpperCase();
    const miloNodes: UINode[] = [
      {
        id: 'node_announcement',
        type: 'announcement_bar',
        props: { text: `100% VET EXPENSE REIMBURSEMENT  |  DIGITAL PET INSURANCE  |  ${wsUpper}` },
      },
      {
        id: 'node_header',
        type: 'header_nav',
        props: { title: `${wsUpper}.` }
      },
      {
        id: 'node_hero',
        type: 'hero_banner',
        layout: 'split',
        props: {
          badge: 'COMPREHENSIVE PET HEALTH INSURANCE',
          headline: `Vet Insurance That Truly Delivers for ${wsUpper}`,
          subtitle: '100% reimbursement on vet bills with zero paperwork. Fast, digital, and transparent.',
          ctaText: 'Get Your Price 🐾',
          ctaUrl: '#products',
          secondaryCtaText: 'View Coverage ›',
          secondaryCtaUrl: '#coberturas',
        }
      },
      {
        id: 'node_features',
        type: 'category_tiles',
        props: {
          title: `Why Pet Owners Choose ${wsUpper}`,
          subtitle: 'Designed by pet lovers for ultimate veterinary peace of mind.',
          items: [
            { title: '100% Reimbursement', description: 'Get 100% of vet expenses refunded directly to your bank in under 72 hours.' },
            { title: 'Any Vet Clinic', description: 'Visit any licensed vet clinic or emergency hospital nationwide.' },
            { title: '100% Digital Claims', description: 'Upload a photo of your receipt from your phone in under 30 seconds.' },
            { title: 'No Hidden Fees', description: 'We cover consultations, surgeries, diagnostics, and 24/7 emergencies.' },
          ]
        }
      },
      {
        id: 'node_checklist',
        type: 'editorial_split',
        props: {
          title: `Everything Included in ${wsUpper} Protection`,
          subtitle: 'Consultations, surgeries, hospitalizations, diagnostics, and 24/7 emergency care with zero deductible surprises.',
        }
      },
      {
        id: 'node_products',
        type: 'product_grid',
        layout: 'grid-3',
        props: {
          title: 'Coverage Plans',
          subtitle: 'Choose the ideal protection plan for your pet',
          items: products.length > 0 ? products : [
            { name: 'Essential Plan', price: 29, badge: 'Popular', description: 'Full emergency & accident coverage.' },
            { name: 'Total 100% Plan', price: 45, badge: 'Recommended', description: '100% reimbursement on all visits & wellness.' },
            { name: 'Senior Gold Plan', price: 59, badge: 'Comprehensive', description: 'Specialized care for dogs over 7 years.' },
          ]
        }
      },
      {
        id: 'node_newsletter',
        type: 'newsletter',
        props: {
          title: 'How Much Does Protecting Your Dog Cost?',
          subtitle: 'Get your custom price quote in less than 1 minute with no obligation.'
        }
      },
      {
        id: 'node_footer',
        type: 'footer',
        props: {
          text: `© ${new Date().getFullYear()} ${wsUpper} PET CARE INC. ALL RIGHTS RESERVED.`
        }
      }
    ];

    return [
      { id: 'route_home', path: '/', title: 'Home', nodes: miloNodes },
      { id: 'route_catalog', path: '/catalog', title: 'Catalog', nodes: miloNodes },
    ];
  }

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

    const routes: UIRoute[] = (!aiOutput?.routes || !Array.isArray(aiOutput.routes) || aiOutput.routes.length === 0 || (aiOutput.routes[0]?.nodes?.length || 0) < 5)
      ? orchestrateIA(options)
      : aiOutput.routes;

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
