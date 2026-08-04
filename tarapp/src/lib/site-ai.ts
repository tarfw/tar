import { type SiteLayout, type Theme, type Section, DEFAULT_THEME } from './site-schema';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export interface SiteProduct {
  name: string;
  price?: number | null;
  variant?: string | null;
}

function extractJson(text: string): any {
  // Strip <think>...</think> reasoning blocks from LLM response
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : cleanText;
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
      reasoning_effort: 'medium',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 100)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty AI response');
  return content;
}

function getSystemPrompt(): string {
  return `You are a site designer. You pick a template, theme, sections, and widgets based on the business description.

Respond with ONLY a JSON object (no markdown, no prose, no reasoning tags) of this exact shape:
{
  "template": "minimal-white",
  "theme": { "primary": "#2563EB", "background": "#FFFFFF", "text": "#0F172A", "font": "Inter", "fontHeading": "Inter" },
  "sections": [
    { "id": "sec_announcement", "type": "announcement_bar", "title": "Headline announcement" },
    { "id": "sec_hero", "type": "hero_banner", "title": "Hero Headline", "subtitle": "Subheading description", "ctaText": "Shop Now" },
    { "id": "sec_products", "type": "product_grid", "title": "Featured Items", "items": [{"name":"Item 1","price":499}] },
    { "id": "sec_testimonials", "type": "testimonials", "title": "Customer Reviews", "items": [{"quote":"Great product!","author":"Jane D."}] },
    { "id": "sec_contact", "type": "contact_form", "title": "Contact Us" },
    { "id": "sec_footer", "type": "footer", "text": "Copyright info" }
  ]
}

Available section types:
- announcement_bar, hero_banner, product_grid, menu_grid, service_list, testimonials, hours, contact_form, footer

Rules:
- Choose vibrant primary colors and themes.
- Each section needs a unique "id" and valid "type".
- Return ONLY the raw JSON object.`;
}

export function createFallbackLayout(storeName: string, promptText: string): SiteLayout {
  const isDark = /dark|black|streetwear/i.test(promptText);
  const isLuxury = /luxury|gold|high-end/i.test(promptText);

  const theme: Theme = isDark
    ? { primary: '#60A5FA', background: '#0F172A', text: '#F8FAFC', font: 'Inter', fontHeading: 'Inter' }
    : isLuxury
    ? { primary: '#D4AF37', background: '#111111', text: '#FFFFFF', font: 'Playfair Display', fontHeading: 'Playfair Display' }
    : { primary: '#2563EB', background: '#FFFFFF', text: '#0F172A', font: 'Inter', fontHeading: 'Inter' };

  return {
    template: isDark ? 'streetwear-dark' : isLuxury ? 'luxury-black' : 'minimal-white',
    theme,
    sections: [
      {
        id: 'sec_announcement',
        type: 'announcement_bar',
        config: { text: `Welcome to ${storeName} · Launch Special Offers Available` },
      },
      {
        id: 'sec_hero',
        type: 'hero_banner',
        config: {
          headline: promptText ? `${promptText.charAt(0).toUpperCase() + promptText.slice(1)}` : `${storeName} Storefront`,
          subtitle: `Experience premium quality products and service at ${storeName}.`,
          ctaText: 'Explore Collection',
        },
      },
      {
        id: 'sec_products',
        type: 'product_grid',
        config: {
          title: 'Featured Collection',
          items: [
            { name: 'Flagship Edition 01', price: 1299, description: 'Premium quality items.' },
            { name: 'Exclusive Edition 02', price: 1899, description: 'Limited batch release.' },
            { name: 'Popular Standard 03', price: 999, description: 'Everyday favorite.' },
          ],
        },
      },
      {
        id: 'sec_testimonials',
        type: 'testimonials',
        config: {
          headline: 'Customer Testimonials',
          items: [
            { quote: 'Exceptional craftsmanship and swift delivery!', author: 'Alex M.' },
            { quote: 'Sleek design and fantastic experience.', author: 'Sarah K.' },
          ],
        },
      },
      {
        id: 'sec_contact',
        type: 'contact_form',
        config: { title: 'Contact Us', submit_label: 'Send Message' },
      },
      {
        id: 'sec_footer',
        type: 'footer',
        config: { text: `© ${new Date().getFullYear()} ${storeName}. All rights reserved.` },
      },
    ],
  };
}

export async function generateSiteLayout(
  storeName: string,
  products: SiteProduct[],
  instruction: string,
  currentLayout?: SiteLayout | null,
): Promise<SiteLayout> {
  try {
    const itemList = products
      .slice(0, 30)
      .map((p) => `- ${p.name}${p.variant ? ` (${p.variant})` : ''}${p.price != null ? ` — ₹${p.price}` : ''}`)
      .join('\n');

    const userPrompt = [
      `Business name: "${storeName}"`,
      products.length ? `Items/Products:\n${itemList}` : 'Items/Products: (none yet)',
      currentLayout ? `Current layout (modify this):\n${JSON.stringify(currentLayout)}` : null,
      `Instruction: "${instruction}"`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = getSystemPrompt();
    const content = await chatCompletion(systemPrompt, userPrompt);
    const parsed = extractJson(content);

    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
      : Array.isArray(parsed.routes?.[0]?.nodes)
      ? parsed.routes[0].nodes
      : [];

    if (!sections || sections.length === 0) {
      return createFallbackLayout(storeName, instruction);
    }

    return {
      template: parsed.template || 'minimal-white',
      theme: parsed.theme || DEFAULT_THEME,
      sections,
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
    };
  } catch (err) {
    console.warn('[SiteAI] Generation fallback activated:', err);
    return createFallbackLayout(storeName, instruction);
  }
}
