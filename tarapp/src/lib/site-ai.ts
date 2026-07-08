import { type SiteLayout, type Theme, type Section } from './site-schema';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

if (!GROQ_API_KEY) {
  console.warn('[SiteAI] Missing EXPO_PUBLIC_GROQ_API_KEY');
}

export interface SiteProduct {
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
  console.log(`[SiteAI] chatCompletion — model: ${GROQ_MODEL}`);

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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[SiteAI] HTTP ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty AI response');
  return content;
}

function getSystemPrompt(vertical: string): string {
  const cleanVertical = (vertical || 'restaurant').toLowerCase();
  
  let verticalPalette = '';
  let widgetPalette = '';

  switch (cleanVertical) {
    case 'restaurant':
      verticalPalette = `
- "menu_grid": { "title": "string", "categories": [{"name":"string", "items": [{"name":"string","price":number,"description":"string","tags":["veg","non-veg","gluten-free"]}]}] }
- "hours": { "title": "string", "days": [{"name":"string","hours":"string"}] }
- "reservation_form": { "title": "string", "buttonText": "string" }
- "gallery": { "images": [{"imageUrl":"string","caption":"string"}] }`;
      widgetPalette = 'booking, contact, chat';
      break;

    case 'salon':
    case 'spa':
      verticalPalette = `
- "service_list": { "title": "string", "services": [{"name":"string","price":number,"duration":"string"}] }
- "stylist_grid": { "title": "string", "staff": [{"name":"string","role":"string","imageUrl":"string"}] }
- "booking_calendar": { "title": "string", "slots": ["string"] }
- "gallery": { "images": [{"imageUrl":"string","caption":"string"}] }`;
      widgetPalette = 'booking, contact, chat';
      break;

    case 'clinic':
    case 'hospital':
      verticalPalette = `
- "doctor_grid": { "doctors": [{"name":"string","specialty":"string"}] }
- "department_list": { "departments": [{"name":"string","description":"string"}] }
- "contact_form": { "email": "string", "phone": "string" }`;
      widgetPalette = 'booking, contact, chat';
      break;

    case 'retail':
    case 'store':
      verticalPalette = `
- "product_grid": { "columns": 2|3|4, "title": "string", "products": [{"name":"string","price":number}] }
- "product_carousel": { "products": [{"name":"string","price":number}] }
- "lookbook_grid": { "columns": 2|3|4, "images": [{"imageUrl":"string","caption":"string"}] }
- "category_row": { "categories": [{"name":"string","imageUrl":"string","href":"string"}] }`;
      widgetPalette = 'cart, contact, chat';
      break;

    case 'gym':
    case 'fitness':
      verticalPalette = `
- "class_schedule": { "classes": [{"name":"string","time":"string","trainer":"string"}] }
- "trainer_grid": { "trainers": [{"name":"string","specialty":"string"}] }
- "membership_plans": { "plans": [{"name":"string","price":number,"features":["string"]}] }`;
      widgetPalette = 'booking, contact, chat';
      break;

    default: // fallback or simple services
      verticalPalette = `
- "service_list": { "title": "string", "services": [{"name":"string","price":number,"description":"string"}] }
- "pricing_table": { "plans": [{"name":"string","price":number,"features":["string"]}] }
- "contact_form": { "email": "string", "phone": "string" }`;
      widgetPalette = 'contact, chat';
      break;
  }

  return `You are a site designer specializing in the "${cleanVertical}" vertical. You pick a template, theme, sections, and widgets.

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "vertical": "${cleanVertical}",
  "template": "template-name",
  "theme": { "primary": "#hex", "background": "#hex", "text": "#hex", "font": "FontName", "fontHeading": "FontName" },
  "sections": [ { "id": "unique-id", "type": "section-type", "config": {} } ],
  "widgets": [ { "type": "widget-type", "config": {} } ]
}

Available templates:
- "streetwear-dark" — bold, dark, minimal (best for modern, nightlife, high-end bold)
- "luxury-black" — elegant, serif fonts, gold/dark accents (for premium, luxury, high-end)
- "minimal-white" — clean, whitespace, modern (for tech, medical, clean shops, cafes)
- "modern-gradient" — colorful, gradient backgrounds (for food, beauty, active, fitness)
- "editorial" — magazine-style, asymmetric (for portfolios, agency, style, salons)

Universal section types (always available):
- "announcement_bar": { "text": "string", "link": "string" }
- "hero": { "headline": "string", "subtext": "string", "cta": "string", "ctaLink": "string" }
- "hero_carousel": { "slides": [{"headline":"string","subtext":"string","cta":"string"}] }
- "section_header": { "title": "string", "subtitle": "string" }
- "testimonials": { "headline": "string", "items": [{"quote":"string","author":"string","role":"string","rating":1-5}] }
- "newsletter": { "headline": "string", "subtext": "string" }
- "rich_text": { "text": "string" }
- "brand_story": { "heading": "string", "body": "string", "imageUrl": "string", "cta": "string" }
- "social_proof": { "stats": [{"value":"string","label":"string"}] }
- "countdown": { "label": "string", "targetDate": "ISO date string" }
- "footer": { "links": [{"label":"string","href":"string"}] }

Vertical-specific section types for "${cleanVertical}":
${verticalPalette}

Available Widget types for this vertical:
- ${widgetPalette} (Choose relevant widgets based on user instruction or default)

Rules:
- Pick the best template, colors, and fonts for the vibe of this "${cleanVertical}" business.
- Start with announcement_bar/hero, end with footer.
- If products/items are provided, make sure to include a product_grid, menu_grid, or service_list.
- Each section needs a unique "id".
- If editing an existing layout, modify ONLY the changed parts. Return the full JSON.
- Return ONLY the JSON object.`;
}

export async function generateSiteLayout(
  storeName: string,
  vertical: string,
  products: SiteProduct[],
  instruction: string,
  currentLayout?: SiteLayout | null,
): Promise<SiteLayout> {
  const itemList = products
    .slice(0, 30)
    .map((p) => `- ${p.name}${p.variant ? ` (${p.variant})` : ''}${p.price != null ? ` — ₹${p.price}` : ''}`)
    .join('\n');

  const userPrompt = [
    `Business name: "${storeName}"`,
    `Business vertical: "${vertical}"`,
    products.length ? `Items/Products:\n${itemList}` : 'Items/Products: (none yet)',
    currentLayout ? `Current layout (modify this):\n${JSON.stringify(currentLayout)}` : null,
    `Instruction: "${instruction}"`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = getSystemPrompt(vertical);
  const content = await chatCompletion(systemPrompt, userPrompt);
  const parsed = extractJson(content);

  return {
    vertical: parsed.vertical || vertical,
    template: parsed.template || 'streetwear-dark',
    theme: parsed.theme || {
      primary: '#5E6AD2',
      background: '#ffffff',
      text: '#111111',
      font: 'Inter',
      fontHeading: 'Inter',
    },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
  };
}
