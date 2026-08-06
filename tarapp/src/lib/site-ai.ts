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

// Maps app preset IDs to the renderer template keys
const PRESET_TEMPLATE_MAP: Record<string, string> = {
  lululemon: 'lululemon',
  notion: 'notion',
  pouch: 'editorial-chalk',
  'editorial-chalk': 'editorial-chalk',
  tech: 'minimal-clean',
  luxury: 'luxury-black',
  cafe: 'organic-warm',
};

function getSystemPrompt(): string {
  return `You are a world-class Webflow & Framer web designer creating high-converting, aesthetically stunning website layouts like Loop Earplugs, Magic Spoon, Tentree, Aesop, and Apple.

Pick a harmonious, high-contrast color palette matched to the business category:
- Cafe / Bakery / Food: Warm cream (#FAF7F5), Terracotta primary (#C86D51), Dark Espresso text (#1C1917), Playfair Display heading font.
- Eco / Organic: Soft sage (#F4F6F4), Forest green primary (#2D4A3E), Charcoal text (#19241E), Plus Jakarta Sans heading font.
- Luxury / Boutique: Deep obsidian (#09090B), Muted Gold primary (#D4AF37), Off-white text (#FAFAFA), Playfair Display heading font.
- Tech / SaaS: Crisp light (#F8FAFC), Charcoal primary (#18181B), Dark navy text (#0F172A), Outfit heading font.
- Pouch / Supplement / Drink: Chalk background (#edebe4), Pulse Blue primary (#000bfa), Pouch Navy text (#01273e), Playfair Display heading font. Use "editorial-chalk" template.
- Notion / Productivity: Warm paper-soft canvas (#f6f5f4), Notion Blue primary (#0075de), Ink text (#000000), Inter font. Use "notion" template.
- Lululemon / Activewear / Fitness: Crisp white canvas (#ffffff), Lululemon Red primary (#D31334), Obsidian text (#111111), Inter font stack, square 0px buttons. Use "lululemon" template and include all 10 sections: announcement_bar, header_nav, hero_banner, category_tiles, product_grid, perks_bar, editorial_split, activity_discovery, community_banner, footer.

CRITICAL ANTI-SLOP RULES:
- NEVER output dark navy (#0F172A) with electric blue (#2563EB) for food, cafe, dining, or bakery prompts. Use warm editorial colors.
- DO NOT add emoji icons (like 🛍️ or 🕒) to headlines or product titles.
- DO NOT add floating pill badges with glowing dots over every section.

Respond with ONLY a JSON object of this exact shape:
{
  "template": "minimal-clean", // Select appropriate template: "lululemon", "editorial-chalk", "notion", "minimal-clean", "luxury-black", "organic-warm"
  "theme": {
    "primary": "#18181B",
    "secondary": "#475569",
    "background": "#F8FAFC",
    "surface": "#FFFFFF",
    "text": "#0F172A",
    "font": "Inter",
    "fontHeading": "Outfit"
  },
  "sections": [
    { "id": "sec_announcement", "type": "announcement_bar", "title": "Headline notification", "link": "#" },
    { "id": "sec_hero", "type": "hero_banner", "variant": "split-2col", "title": "Bold Main Headline", "subtitle": "Compelling value proposition subtitle.", "badge": "New Launch", "ctaText": "Get Started", "ctaUrl": "#products", "secondaryCtaText": "Learn More" },
    { "id": "sec_products", "type": "product_grid", "variant": "minimal-cards", "title": "Featured Solutions", "subtitle": "Designed for modern teams", "items": [{"name":"Item Name","price":299,"badge":"Popular","description":"Short highlight description."}] },
    { "id": "sec_testimonials", "type": "testimonials", "variant": "avatar-card", "title": "Client Reviews", "subtitle": "Trusted by industry leaders", "items": [{"quote":"Life changing quality!","author":"Sarah M.","role":"Verified Client","rating":5}] },
    { "id": "sec_contact", "type": "contact_form", "title": "Get In Touch", "subtitle": "Have questions? We respond within 24 hours.", "submit_label": "Send Message" },
    { "id": "sec_footer", "type": "footer", "variant": "minimal-bar", "text": "Copyright tagline", "links": [{"label":"Privacy","href":"#"},{"label":"Terms","href":"#"}] }
  ]
}

Available section types:
- announcement_bar, header_nav, hero_banner, category_tiles, product_grid, perks_bar, editorial_split, activity_discovery, community_banner, menu_grid, service_list, testimonials, hours, contact_form, footer

Rules:
- Generate category-appropriate color palettes.
- Return ONLY the raw JSON object.`;
}

export function createFallbackLayout(storeName: string, promptText: string, forcedTemplate?: string | null): SiteLayout {
  const combined = (storeName + ' ' + promptText).toLowerCase();
  const isLululemon = forcedTemplate === 'lululemon' || /lululemon|activewear|athletic|leggings|yoga|workout|gym|apparel/i.test(combined);
  const isNotion   = forcedTemplate === 'notion'    || /notion|workspace|doc|notes|productivity|wiki/i.test(combined);
  const isPouch    = forcedTemplate === 'editorial-chalk' || /pouch|supplement|drink|chalk/i.test(combined);


  if (isLululemon) {
    return {
      template: 'lululemon',
      theme: {
        primary: '#D31334',
        secondary: '#111111',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#111111',
        font: 'Inter',
        fontHeading: 'Inter',
      },
      sections: [
        {
          id: 'sec_00_announcement_bar',
          type: 'announcement_bar',
          config: { text: 'FREE SHIPPING & RETURNS ON ALL UK ORDERS · SHOP NEW ARRIVALS' },
        },
        {
          id: 'sec_01_header_nav',
          type: 'header_nav',
          config: { workspaceName: storeName || 'lululemon' },
        },
        {
          id: 'sec_02_hero_banner',
          type: 'hero_banner',
          variant: 'fullscreen-bg',
          config: {
            badge: 'FEEL THE SPEED',
            headline: 'Made for Movement',
            subtitle: 'Unmatched technical performance, weightless feel, and buttery-soft feel engineered for yoga, running, and training.',
            ctaText: 'SHOP WOMEN',
            ctaUrl: '#women',
            secondaryCtaText: 'SHOP MEN',
            secondaryCtaUrl: '#men',
          },
        },
        {
          id: 'sec_03_category_tiles',
          type: 'category_tiles',
          config: {
            title: 'Shop by Category',
            subtitle: 'Gear designed for your favorite activities.',
          },
        },
        {
          id: 'sec_04_product_grid',
          type: 'product_grid',
          variant: 'spec-cards',
          config: {
            title: 'Iconic Performance Gear',
            subtitle: 'Engineered with Nulu™ and Everlux™ proprietary technical fabrics.',
            items: [
              { name: 'Align™ High-Rise Pant 25"', price: 88, badge: 'Best Seller', description: 'Nulu™ Fabric — Buttery soft feel with zero distraction.' },
              { name: 'Scuba Oversized Funnel Neck', price: 118, badge: 'Trending', description: 'Breathable warmth with fleece interior and thumbholes.' },
              { name: 'Everywhere Belt Bag 1L', price: 38, badge: 'Must Have', description: 'Water-repellent fabric for life on the move.' },
              { name: 'Metal Vent Tech Short Sleeve', price: 68, badge: 'Men Favorite', description: 'Seamless construction with Silverescent™ anti-stink technology.' },
            ],
          },
        },
        {
          id: 'sec_05_perks_bar',
          type: 'perks_bar',
          config: {
            title: 'Lululemon Member Perks',
          },
        },
        {
          id: 'sec_06_editorial_split',
          type: 'editorial_split',
          config: {
            headline: 'Designed for the Studio & Beyond',
            subtitle: 'Technical gear built to stand up to heavy sweat sessions while maintaining pure everyday elegance.',
          },
        },
        {
          id: 'sec_07_activity_discovery',
          type: 'activity_discovery',
          config: {
            title: 'Find Your Activity',
          },
        },
        {
          id: 'sec_08_community_banner',
          type: 'community_banner',
          config: {
            title: 'Join the Lululemon Community',
            subtitle: 'Receive early access to product drops, events, and member perks.',
          },
        },
        {
          id: 'sec_09_footer',
          type: 'footer',
          variant: 'multi-column-border',
          config: { text: `© ${new Date().getFullYear()} lululemon athletica. All rights reserved. United Kingdom | GBP` },
        },
      ],
    };
  }

  if (isNotion) {
    return {
      template: 'notion',
      theme: {
        primary: '#0075de',
        secondary: '#213183',
        background: '#f6f5f4',
        surface: '#ffffff',
        text: '#000000',
        font: 'Inter',
        fontHeading: 'Inter',
      },
      sections: [
        {
          id: 'sec_announcement',
          type: 'announcement_bar',
          config: { text: `Meet the new Notion workspace · All-in-one docs, wikis & projects` },
        },
        {
          id: 'sec_hero',
          type: 'hero_banner',
          variant: 'split-2col',
          config: {
            badge: 'Notion 3.0',
            headline: promptText ? `${promptText.charAt(0).toUpperCase() + promptText.slice(1)}` : `Write, plan, and share in ${storeName}`,
            subtitle: 'A warm, paper-calm productivity system built on an off-white canvas for modern teams.',
            ctaText: 'Get Notion free',
            ctaUrl: '#products',
            secondaryCtaText: 'Request a demo',
          },
        },
        {
          id: 'sec_products',
          type: 'product_grid',
          variant: 'minimal-cards',
          config: {
            title: 'Building blocks for every team',
            subtitle: 'Docs, wikis, projects, and AI connected in one paper-soft workspace.',
            items: [
              { name: 'Notion AI', price: 10, badge: 'Add-on', description: 'Integrated Q&A, writing assistant, and autofill tables.' },
              { name: 'Wikis & Knowledge', price: 0, badge: 'Core', description: 'Centralized team knowledge base with instant search.' },
              { name: 'Projects & Tasks', price: 0, badge: 'Core', description: 'Flexible Kanban boards, roadmaps, and sprint trackers.' },
            ],
          },
        },
        {
          id: 'sec_testimonials',
          type: 'testimonials',
          variant: 'avatar-card',
          config: {
            title: 'Loved by teams worldwide',
            subtitle: 'Empowering startups to global enterprises',
            items: [
              { quote: 'Notion is the brain of our entire engineering organization. We rely on it daily.', author: 'Head of Product', role: 'Global Tech Lead', rating: 5 },
              { quote: 'Clean, calm, and infinitely customizable. Nothing else comes close.', author: 'Design Director', role: 'Creative Studio', rating: 5 },
            ],
          },
        },
        {
          id: 'sec_contact',
          type: 'contact_form',
          config: { title: 'Get Notion free', subtitle: 'Request a demo or get started with your team today.', submit_label: 'Get Started' },
        },
        {
          id: 'sec_footer',
          type: 'footer',
          variant: 'minimal-bar',
          config: { text: `© ${new Date().getFullYear()} ${storeName}. All rights reserved.` },
        },
      ],
    };
  }

  return {
    template: 'minimal-clean',
    theme: {
      primary: '#18181B',
      secondary: '#475569',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      font: 'Inter',
      fontHeading: 'Outfit',
    },
    sections: [
      {
        id: 'sec_announcement',
        type: 'announcement_bar',
        config: { text: `Welcome to ${storeName} · Discover our latest solutions & offerings` },
      },
      {
        id: 'sec_hero',
        type: 'hero_banner',
        variant: 'split-2col',
        config: {
          badge: 'Official Launch',
          headline: promptText ? `${promptText.charAt(0).toUpperCase() + promptText.slice(1)}` : `Welcome to ${storeName}`,
          subtitle: 'Streamlined performance, exceptional quality, and modern standards crafted for high-growth businesses.',
          ctaText: 'Explore Features',
          ctaUrl: '#products',
          secondaryCtaText: 'Learn More',
        },
      },
      {
        id: 'sec_products',
        type: 'product_grid',
        variant: 'minimal-cards',
        config: {
          title: 'Featured Offerings',
          subtitle: 'Handcrafted items selected for exceptional performance',
          items: [
            { name: 'Core Edition 01', price: 290, badge: 'Popular', description: 'Engineered for reliability and seamless integration.' },
            { name: 'Pro Edition 02', price: 490, badge: 'Top Rated', description: 'Advanced capabilities built for demanding workloads.' },
            { name: 'Enterprise Edition 03', price: 890, badge: 'Full Access', description: 'Complete feature suite with dedicated priority support.' },
          ],
        },
      },
      {
        id: 'sec_testimonials',
        type: 'testimonials',
        variant: 'avatar-card',
        config: {
          title: 'Client Feedback',
          subtitle: 'Trusted by leaders and innovators worldwide',
          items: [
            { quote: 'Exceptional build quality and intuitive performance. A game changer for our daily workflow.', author: 'Alex Morgan', role: 'Director of Product', rating: 5 },
            { quote: 'Reliable, beautiful, and effortless to integrate. Highly recommended.', author: 'Sarah Chen', role: 'Founder & CEO', rating: 5 },
          ],
        },
      },
      {
        id: 'sec_contact',
        type: 'contact_form',
        config: { title: 'Get In Touch', subtitle: 'Have questions? Our team responds within 24 hours.', submit_label: 'Send Message' },
      },
      {
        id: 'sec_footer',
        type: 'footer',
        variant: 'minimal-bar',
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
  templateHint?: string,
): Promise<SiteLayout> {
  // Resolve canonical template name from hint
  const forcedTemplate = templateHint ? (PRESET_TEMPLATE_MAP[templateHint] || templateHint) : null;

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
      return createFallbackLayout(storeName, instruction, forcedTemplate);
    }

    return {
      // forcedTemplate always wins over whatever the AI returned
      template: forcedTemplate || parsed.template || 'minimal-white',
      theme: parsed.theme || DEFAULT_THEME,
      sections,
      widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
    };
  } catch (err) {
    console.warn('[SiteAI] Generation fallback activated:', err);
    return createFallbackLayout(storeName, instruction, forcedTemplate);
  }
}
