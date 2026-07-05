/**
 * AI generation of storefront layouts.
 *
 * The AI picks a template and generates a config (theme + sections).
 * The Worker renders the template with the config.
 *
 * Token costs:
 * - First generation: ~500 tokens
 * - Edit (theme change): ~200 tokens
 * - Edit (add section): ~400 tokens
 * - Custom (no template): ~4000 tokens
 */

import { TEMPLATES, type StorefrontLayout, type Theme, type Section } from './storefront-schema';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
if (!GROQ_API_KEY) {
  console.warn('[StorefrontAI] Missing EXPO_PUBLIC_GROQ_API_KEY');
}

export interface StorefrontProduct {
  name: string;
  price?: number | null;
  variant?: string | null;
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in AI response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function chatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GROQ_API_KEY');
  }
  console.log(`[StorefrontAI] chatCompletion — model: ${GROQ_MODEL}`);

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  console.log(`[StorefrontAI] HTTP status: ${res.status}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[StorefrontAI] HTTP ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  console.log(`[StorefrontAI] content length: ${content.length}`);
  if (!content) throw new Error('Empty AI response');
  return content;
}

const SYSTEM_PROMPT = `You are a storefront designer. You pick a template and generate a config for an online store.

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "template": "template-name",
  "theme": { "primary": "#hex", "background": "#hex", "text": "#hex", "font": "FontName", "fontHeading": "FontName" },
  "sections": [ { "id": "unique-id", "type": "section-type", "config": {} } ]
}

Available templates:
- "streetwear-dark" — bold, dark, minimal (default for streetwear, sneakers, urban)
- "luxury-black" — elegant, serif fonts, gold accents (for luxury, jewelry, high-end)
- "minimal-white" — clean, whitespace, modern (for tech, home, lifestyle)
- "modern-gradient" — colorful, gradient backgrounds (for food, beauty, creative)
- "editorial" — magazine-style, asymmetric (for fashion, art, editorial)

Available section types:
- "announcement_bar": { "text": "string" }
- "hero": { "headline": "string", "subtext": "string", "cta": "string", "ctaLink": "string" }
- "hero_carousel": { "slides": [{"headline":"string","subtext":"string","cta":"string"}] }
- "section_header": { "title": "string", "subtitle": "string" }
- "product_grid": { "columns": 2|3|4, "title": "string", "products": [{"name":"string","price":number}] }
- "product_carousel": { "products": [{"name":"string","price":number}] }
- "lookbook_grid": { "columns": 2|3|4, "images": [{"imageUrl":"string","caption":"string"}] }
- "testimonials": { "headline": "string", "items": [{"quote":"string","author":"string","role":"string","rating":1-5}] }
- "newsletter": { "headline": "string", "subtext": "string" }
- "promo_tiles": { "tiles": [{"imageUrl":"string","title":"string","href":"string"}] }
- "category_row": { "categories": [{"name":"string","imageUrl":"string","href":"string"}] }
- "rich_text": { "text": "string" }
- "brand_story": { "heading": "string", "body": "string", "imageUrl": "string", "cta": "string" }
- "social_proof": { "stats": [{"value":"string","label":"string"}] }
- "countdown": { "label": "string", "targetDate": "ISO date string" }
- "footer": { "links": [{"label":"string","href":"string"}] }

Rules:
- Pick the best template for the store's vibe.
- Theme colors should be cohesive and match the template style.
- Start with hero section, end with footer.
- If products are provided, include a product_grid or product_carousel.
- Each section needs a unique "id" (e.g., "hero-1", "products-main").
- If editing an existing layout, modify ONLY the changed parts. Return the full sections array.
- Return ONLY the JSON object.`;

/**
 * Generate (or edit) a storefront layout from a natural-language instruction.
 * Pass `currentLayout` for edit requests so the model modifies the existing config.
 */
export async function generateStorefrontLayout(
  storeName: string,
  products: StorefrontProduct[],
  instruction: string,
  currentLayout?: StorefrontLayout | null,
): Promise<StorefrontLayout> {
  const productList = products
    .slice(0, 30)
    .map((p) => `- ${p.name}${p.variant ? ` (${p.variant})` : ''}${p.price != null ? ` — ₹${p.price}` : ''}`)
    .join('\n');

  const userPrompt = [
    `Store name: "${storeName}"`,
    products.length ? `Products:\n${productList}` : 'Products: (none yet)',
    currentLayout ? `Current layout (modify this):\n${JSON.stringify(currentLayout)}` : null,
    `Instruction: "${instruction}"`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = await chatCompletion(SYSTEM_PROMPT, userPrompt);
  const parsed = extractJson(content);

  return {
    template: parsed.template || 'streetwear-dark',
    theme: parsed.theme || {
      primary: '#5E6AD2',
      background: '#ffffff',
      text: '#111111',
      font: 'Inter',
      fontHeading: 'Inter',
    },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
}
