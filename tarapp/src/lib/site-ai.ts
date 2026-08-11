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
  milo: 'milo',
  kith: 'kith',
  empire: 'empire',
  joandso: 'joandso',
  eql: 'eql',
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
- Kith / Streetwear / Lifestyle: Monochrome black & white canvas (#ffffff / #000000), Pitch black primary (#000000), Inter font, square 0px geometry. Use "kith" template and MUST include all 9 sections in exact order: announcement_bar, header_nav, hero_carousel, section_hero, lookbook_grid, section_hero, lookbook_grid, product_grid, newsletter, footer.

CRITICAL ANTI-SLOP RULES:
- NEVER output dark navy (#0F172A) with electric blue (#2563EB) for food, cafe, dining, or bakery prompts. Use warm editorial colors.
- DO NOT add emoji icons (like 🛍️ or 🕒) to headlines or product titles.
- DO NOT add floating pill badges with glowing dots over every section.

Respond with ONLY a JSON object of this exact shape:
{
  "template": "kith", // Select appropriate template: "kith", "lululemon", "editorial-chalk", "notion", "minimal-clean", "luxury-black", "organic-warm"
  "theme": {
    "primary": "#000000",
    "secondary": "#E5E5E5",
    "background": "#FFFFFF",
    "surface": "#F5F5F5",
    "text": "#000000",
    "font": "Inter",
    "fontHeading": "Inter"
  },
  "sections": [
    { "id": "sec_announcement", "type": "announcement_bar", "title": "FREE SHIPPING ON ORDERS OVER $150 · EASY RETURNS · NEW DROP LIVE NOW" },
    { "id": "sec_header", "type": "header_nav", "title": "KITH" },
    { "id": "sec_hero_carousel", "type": "hero_carousel", "title": "KITH Summer 2026", "items": [{"title":"Summer 2026","subtitle":"New Delivery","ctaText":"Shop Now","image":"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1920&h=960&fit=crop"}] },
    { "id": "sec_hero_summer", "type": "section_hero", "title": "Kith Summer 2026", "subtitle": "New Delivery", "image": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1920&h=960&fit=crop" },
    { "id": "sec_lookbook_1", "type": "lookbook_grid", "images": ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop"] },
    { "id": "sec_hero_kin", "type": "section_hero", "title": "&Kin Summer 2026", "subtitle": "Lifestyle", "image": "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1920&h=960&fit=crop" },
    { "id": "sec_lookbook_2", "type": "lookbook_grid", "images": ["https://images.unsplash.com/photo-1434389677669-e08b4cda3a23?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=800&fit=crop","https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop"] },
    { "id": "sec_products", "type": "product_grid", "variant": "kith-card", "title": "Featured Collection", "subtitle": "New drops & classics", "items": [{"name":"Classic Logo Tee — White","price":95,"badge":"New","image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop"},{"name":"Stripe Hoodie — Navy","price":195,"image":"https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop"}] },
    { "id": "sec_newsletter", "type": "newsletter", "title": "Join Our List", "subtitle": "Sign up for exclusive access to new releases." },
    { "id": "sec_footer", "type": "footer", "variant": "kith-minimal-bar", "text": "© 2026 KITH RETAIL LLC. ALL RIGHTS RESERVED." }
  ]
}

Available section types:
- announcement_bar, header_nav, hero_banner, hero_carousel, section_hero, lookbook_grid, category_tiles, product_grid, perks_bar, editorial_split, activity_discovery, community_banner, menu_grid, service_list, testimonials, hours, contact_form, newsletter, footer

Rules:
- Generate category-appropriate color palettes.
- Return ONLY the raw JSON object.`;
}

export function createFallbackLayout(storeName: string, promptText: string, forcedTemplate?: string | null): SiteLayout {
  const combined = (storeName + ' ' + promptText).toLowerCase();
  const isEql      = forcedTemplate === 'eql'       || /eql|launch|drop|raffle|fair|hype/i.test(combined);
  const isJoandso  = forcedTemplate === 'joandso'   || /joandso|jo & so|portugal|hotel|travel|boutique/i.test(combined);
  const isEmpire   = forcedTemplate === 'empire'    || /empire|music|label|publisher|record|artist/i.test(combined);
  const isMilo     = forcedTemplate === 'milo'      || /milo|pet|vet|insurance|dog/i.test(combined);
  const isKith     = forcedTemplate === 'kith'      || /kith|streetwear|monochrome|lookbook/i.test(combined);

  if (isEql) {
    const wsUpper = (storeName || 'EQL').toUpperCase();
    return {
      template: 'eql',
      theme: {
        primary: '#0A0A0C',
        secondary: '#4D65FF',
        background: '#F9F9FB',
        surface: '#FFFFFF',
        text: '#0A0A0C',
        font: 'Inter',
        fontHeading: 'Plus Jakarta Sans',
      },
      sections: [
        {
          id: 'sec_00_announcement',
          type: 'marquee_strip',
          variant: 'launch_ticker',
          contract: { bg: '#0A0A0C', text_color: '#FFE600', font_size: '11px', letter_spacing: '0.22em', speed: '18s' },
          config: { text: `RUN FAIR® · POWERING HIGH-DEMAND LAUNCHES · ZERO BOTS · CERTIFIED BOT-FREE PRODUCT DROPS · ${wsUpper}` },
        },
        {
          id: 'sec_01_header_nav',
          type: 'navigation_bar',
          variant: 'eql_header',
          contract: { sticky: true, bg: 'rgba(249, 249, 251, 0.94)', backdrop_blur: '20px', logo_position: 'left', cta_bg: '#FFE600', cta_text: '#0A0A0C', cta_shape: 'pill' },
          config: { brand_name: wsUpper, cta_label: 'CONTACT SALES' },
        },
        {
          id: 'sec_02_hero',
          type: 'media_hero',
          variant: 'launch_hero',
          contract: { layout_mode: 'split', height: '80vh', cta_bg: '#0A0A0C', cta_text: '#FFFFFF' },
          config: {
            badge: 'CERTIFIED RUN FAIR® PLATFORM',
            headline: 'GET MORE OUT OF EVERY DROP.',
            subtitle: 'EQL helps leading brands and retailers run secure, bot-free, fair launches for their most in-demand products and limited releases.',
            ctaText: 'EXPLORE THE PLATFORM',
            secondaryCtaText: 'HOW RUN FAIR® WORKS ›',
            image: 'https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71f8e8481fb72988aa1a3b_two_women_watching_phone_screen_converted.avif',
          },
        },
        {
          id: 'sec_03_features',
          type: 'content_grid',
          variant: 'eql_features',
          contract: { columns: 4, gap: '20px', aspect_ratio: '4/3', hover_zoom: 1.06, card_bg: '#FFFFFF', card_border: '1px solid rgba(10,10,12,0.1)', card_radius: '12px' },
          config: {
            title: 'BUILT FOR THE MOST IN-DEMAND LAUNCHES',
            subtitle: 'Run high-traffic drops without site crashes, bot scalping, or customer frustration.',
            items: [
              { title: 'Sneaker & Footwear Drops', description: 'Bot mitigation & entry verification for high-demand limited sneaker releases.', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&h=600&fit=crop' },
              { title: 'Collectibles & Art Exclusives', description: 'Fair raffle allocation & multi-entry fraud detection for limited collectibles.', image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&h=600&fit=crop' },
              { title: 'Limited Edition Spirits', description: 'Verification & geo-compliance for high-value rare whiskey & spirit releases.', image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&h=600&fit=crop' },
              { title: 'Live Event & Festival Tickets', description: 'Stress-free ticketing launches with instant checkout queueing & anti-reseller protection.', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=600&fit=crop' },
            ],
          },
        },
        {
          id: 'sec_04_story',
          type: 'story_banner',
          variant: 'eql_runfair',
          contract: { bg: '#0A0A0C', text_color: '#FFFFFF' },
          config: {
            title: 'THE INDUSTRY STANDARD FOR PRODUCT LAUNCHES WITH INTEGRITY',
            subtitle: 'Every launch powered by EQL is certified Run Fair®. Our proprietary AI engine filters out malicious bots, automated scripts, and duplicate entries so real fans get a fair shot.',
            highlights: [
              '99.8% Bot & Automated Script Mitigation Accuracy',
              'Zero Site Downtime or Checkout Queue Crashes',
              'Seamless Shopify & Enterprise E-Commerce Integration',
              'Transparent Winner Selection & Instant Payment Capture',
            ],
            image: 'https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71f90186bc6fa39c8d1add_nike_running_apparel_diverse_smiling_group_converted.avif',
          },
        },
        {
          id: 'sec_05_footer',
          type: 'action_strip',
          variant: 'launch_action',
          config: { text: `© ${new Date().getFullYear()} ${wsUpper} Commerce Inc. Run Fair® is a registered trademark of EQL.` },
        },
      ],
    };
  }

  if (isJoandso) {
    const wsTitle = storeName || 'JO & SO';
    return {
      template: 'joandso',
      theme: {
        primary: '#2C2523',
        secondary: '#B57D14',
        background: '#FAF7F2',
        surface: '#FFFFFF',
        text: '#2C2523',
        font: 'Inter',
        fontHeading: 'Playfair Display',
      },
      sections: [
        {
          id: 'sec_00_announcement',
          type: 'marquee_strip',
          variant: 'warm_ticker',
          contract: { bg: '#2C2523', text_color: '#FAF7F2', font_size: '11px', letter_spacing: '0.2em', speed: '20s' },
          config: { text: 'JO&SO INSIDER GUIDE · HANDPICKED BOUTIQUE HOTELS IN PORTUGAL · LISBON · PORTO · ALGARVE · COMPORTA · AZORES' },
        },
        {
          id: 'sec_01_header_nav',
          type: 'navigation_bar',
          variant: 'joandso_header',
          contract: { sticky: true, bg: 'rgba(250, 247, 242, 0.94)', backdrop_blur: '20px', logo_position: 'center', cta_bg: '#2C2523', cta_text: '#FAF7F2', cta_shape: 'pill' },
          config: { brand_name: wsTitle, cta_label: 'Search Stays' },
        },
        {
          id: 'sec_02_hero',
          type: 'media_hero',
          variant: 'warm_editorial',
          contract: { layout_mode: 'split', height: '75vh', cta_bg: '#2C2523', cta_text: '#FFFFFF' },
          config: {
            badge: 'INSIDER PORTUGAL HOTEL GUIDE',
            headline: 'The cool hotels in Portugal handpicked by two Portuguese sisters.',
            subtitle: 'Discover curated boutique stays, rural farmhouses, and design hideaways across Lisbon, Porto, Algarve, Comporta & beyond.',
            ctaText: 'Explore All 106 Hotels ›',
            secondaryCtaText: 'Browse By Region',
            image: 'https://cdn.prod.website-files.com/5fecc80e92fcdb7da9d1f0fb/6808ba6ad259ea809f952558_joandso-cool-hotels-portugal-joana-sofia-1600.webp',
          },
        },
        {
          id: 'sec_03_regions',
          type: 'content_grid',
          variant: 'joandso_regions',
          contract: { columns: 4, gap: '20px', aspect_ratio: '4/3', hover_zoom: 1.05, card_bg: '#FFFFFF', card_border: '1px solid rgba(44,37,35,0.08)', card_radius: '12px' },
          config: {
            title: 'Boutique Hotels in Portugal by Region',
            subtitle: "Explore our personal recommendations for the best stays across Portugal's unique landscapes.",
            items: [
              { title: 'Boutique Hotels in Lisbon', description: 'Romantic cobblestone lanes, lively café culture & rooftop views.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69174e50e9b4bef98179440e_%20best-boutique-hotels-lisbon-memmo-principe-real-breakfast-joandso.webp' },
              { title: 'Boutique Hotels in Porto', description: 'Historic riverfront hills, Port wine cellars & Douro views.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6917508d01e2302dbc08c3e8_%20best-boutique-hotels-porto-historic-steps-douro-river-joandso.webp' },
              { title: 'Boutique Hotels in Algarve', description: 'Golden limestone cliffs, turquoise coves & fruit tree orchards.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6917543f92053ca1b679da4a_best-boutique-hotels-algarve-golden-cliffs-beach-joandso.webp' },
              { title: 'Boutique Hotels in Alentejo', description: 'Whitewashed sleepy villages, cork groves & wild empty beaches.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175654e5ca87493373e9c4_best-boutique-hotels-alentejo-horseback-riding-countryside-joandso.webp' },
              { title: 'Boutique Hotels in North Portugal', description: 'Terraced Douro vineyards, wine estates & green mountain valleys.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6a6b5e5cfe3c73cdb5fdb56e_vidago-palace-hotel-best-hotels-north-portugal-joandso.webp' },
              { title: 'Boutique Hotels in Central Portugal', description: 'Schist stone villages, Serra da Estrela peaks & Silver Coast waves.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175a522d7d4504933c2646_central-portugal-schist-architecture-mountain-landscape-boutique-hotels-joandso.webp' },
              { title: 'Boutique Hotels in Azores', description: 'Twin volcanic crater lakes, hot springs & lush island botanicals.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/691749afc3d7b13e951c4796_best-boutique-hotels-azores-sete-cidades.webp' },
              { title: 'Boutique Hotels in Madeira', description: 'Dramatic Atlantic cliff estates, subtropical gardens & ocean views.', image: 'https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175d7ff508ae2f05113071_best-boutique-hotels-madeira-reids-palace-funchal-volcanic-cliffs.webp' },
            ],
          },
        },
        {
          id: 'sec_04_story',
          type: 'story_banner',
          variant: 'joandso_sisters',
          contract: { bg: '#FAF7F2', text_color: '#2C2523' },
          config: {
            title: 'CURATED WITH LOVE BY TWO PORTUGUESE SISTERS',
            subtitle: 'Hi, we are Joana and Sofia Lacerda. We personally visit and review every single boutique hotel, guesthouse, and secret stay on JO&SO so you get honest, insider recommendations.',
            highlights: [
              '100% Personally Vetted & Tested Portugal Stays',
              'No Paid Advertising or Sponsored Placements',
              'Direct Booking Links & Exclusive Sister Perks',
              "Authors of 'The 500 Hidden Secrets of Porto'",
            ],
            image: 'https://cdn.prod.website-files.com/5fecc80e92fcdb7da9d1f0fb/66c31e9973b741e8535c61a2_joandso-cool-hotels-portugal-joana-sofia.webp',
          },
        },
        {
          id: 'sec_05_footer',
          type: 'action_strip',
          variant: 'warm_newsletter',
          config: { text: `© ${new Date().getFullYear()} JO&SO Collection Inc. Handpicked boutique stays in Portugal.` },
        },
      ],
    };
  }

  if (isEmpire) {
    const wsUpper = (storeName || 'EMPIRE').toUpperCase();
    return {
      template: 'empire',
      theme: {
        primary: '#FFFFFF',
        secondary: '#1A1A1A',
        background: '#000000',
        surface: '#0A0A0A',
        text: '#FFFFFF',
        font: 'Inter',
        fontHeading: 'Inter Tight',
      },
      sections: [
        {
          id: 'sec_00_announcement',
          type: 'marquee_strip',
          variant: 'black_ticker',
          contract: { bg: '#000000', text_color: '#E50914', font_size: '11px', letter_spacing: '0.22em', speed: '18s' },
          config: { text: `EMPIRE PUBLISHING · GLOBAL MUSIC DISTRIBUTION · HIP-HOP / AFROBEATS / LATIN / R&B · ${wsUpper}` },
        },
        {
          id: 'sec_01_header_nav',
          type: 'navigation_bar',
          variant: 'empire_header',
          contract: { sticky: true, bg: 'rgba(0,0,0,0.92)', backdrop_blur: '24px', logo_position: 'left', cta_bg: '#FFFFFF', cta_text: '#000000', cta_shape: 'square' },
          config: { brand_name: wsUpper, cta_label: 'SUBMIT DEMO' },
        },
        {
          id: 'sec_02_hero',
          type: 'media_hero',
          variant: 'cinematic_dark',
          contract: { layout_mode: 'overlay', height: '85vh', cta_bg: '#FFFFFF', cta_text: '#000000' },
          config: {
            badge: 'INDEPENDENT LABEL & GLOBAL PUBLISHER',
            headline: 'ELEVATING GLOBAL MUSIC TALENT.',
            subtitle: 'Direct-to-DSP distribution, sync licensing, and financial transparency for independent artists worldwide.',
            ctaText: 'EXPLORE ROSTER',
            secondaryCtaText: 'PUBLISHING ADMIN ›',
            image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1920&h=1080&fit=crop',
          },
        },
        {
          id: 'sec_03_roster',
          type: 'content_grid',
          variant: 'empire_roster',
          contract: { columns: 4, gap: '20px', aspect_ratio: '1/1', hover_zoom: 1.08, card_bg: '#0A0A0A', card_border: '1px solid rgba(255,255,255,0.12)', card_radius: '0px' },
          config: {
            title: 'FEATURED RELEASES & ARTISTS',
            subtitle: 'Global chart-topping independent music across Hip-Hop, Afrobeats, Latin, and R&B.',
            items: [
              { title: 'Asake', description: 'Lunky · Afrobeats', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop' },
              { title: 'Shaboozey', description: 'A Bar Song (Tipsy) · Country / Hip-Hop', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop' },
              { title: 'Fireboy DML', description: 'Adedamola · R&B / Afro-Pop', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop' },
              { title: 'Key Glock', description: 'Glockoma 2 · Memphis Trap', image: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800&h=800&fit=crop' },
            ],
          },
        },
        {
          id: 'sec_04_story',
          type: 'story_banner',
          variant: 'empire_story',
          contract: { bg: '#050505', text_color: '#FFFFFF' },
          config: {
            title: 'THE FUTURE OF INDEPENDENT MUSIC.',
            subtitle: 'EMPIRE empowers creators with global DSP delivery, international sync administration, state-of-the-art recording facilities, and transparent real-time royalty reporting.',
            highlights: [
              '100% Master Ownership & Creative Control',
              'Direct DSP Distribution (Spotify, Apple, TikTok, YouTube)',
              'International Sync Licensing & Publishing Admin',
              'Real-time Royalty Tracking & Instant Mobile Payouts',
            ],
            image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=800&fit=crop',
          },
        },
        {
          id: 'sec_05_footer',
          type: 'action_strip',
          variant: 'footer',
          config: { text: `© ${new Date().getFullYear()} ${wsUpper} Distribution, Records & Publishing Inc. All rights reserved.` },
        },
      ],
    };
  }
  const isLululemon = forcedTemplate === 'lululemon' || /lululemon|activewear|athletic|leggings|yoga|workout|gym|apparel/i.test(combined);
  const isNotion   = forcedTemplate === 'notion'    || /notion|workspace|doc|notes|productivity|wiki/i.test(combined);
  const isPouch    = forcedTemplate === 'editorial-chalk' || /pouch|supplement|drink|chalk/i.test(combined);

  if (isMilo) {
    const wsUpper = (storeName || 'MILO').toUpperCase();
    return {
      template: 'milo',
      theme: {
        primary: '#1FCB60',
        secondary: '#032E1C',
        background: '#FAF7F2',
        surface: '#FFFFFF',
        text: '#032E1C',
        font: 'Montserrat',
        fontHeading: 'Marcellus',
      },
      sections: [
        { id: 'sec_announcement', type: 'announcement_bar', title: `100% VET EXPENSE REIMBURSEMENT  |  DIGITAL PET INSURANCE  |  ${wsUpper}` },
        { id: 'sec_header', type: 'header_nav', title: `${wsUpper}.` },
        { id: 'sec_hero', type: 'hero_banner', layout: 'split', title: `Vet Insurance That Truly Delivers for ${wsUpper}`, subtitle: '100% reimbursement on vet bills with zero paperwork. Fast, digital, and transparent.', ctaText: 'Get Your Price 🐾' },
        { id: 'sec_features', type: 'category_tiles', title: `Why Pet Owners Choose ${wsUpper}`, items: [
          { title: '100% Reimbursement', description: 'Get 100% of vet expenses refunded directly to your bank in under 72 hours.' },
          { title: 'Any Vet Clinic', description: 'Visit any licensed vet clinic or emergency hospital nationwide.' },
          { title: '100% Digital Claims', description: 'Upload a photo of your receipt from your phone in under 30 seconds.' },
          { title: 'No Hidden Fees', description: 'We cover consultations, surgeries, diagnostics, and 24/7 emergencies.' }
        ]},
        { id: 'sec_checklist', type: 'editorial_split', title: `Everything Included in ${wsUpper} Protection`, subtitle: 'Consultations, surgeries, hospitalizations, diagnostics, and 24/7 emergency care with zero deductible surprises.' },
        { id: 'sec_products', type: 'product_grid', title: 'Coverage Plans', subtitle: 'Choose the ideal protection plan for your pet', items: [
          { name: 'Essential Plan', price: 29, badge: 'Popular', image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&h=800&fit=crop' },
          { name: 'Total 100% Plan', price: 45, badge: 'Recommended', image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&h=800&fit=crop' },
          { name: 'Senior Gold Plan', price: 59, badge: 'Comprehensive', image: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600&h=800&fit=crop' }
        ]},
        { id: 'sec_newsletter', type: 'newsletter', title: 'How Much Does Protecting Your Dog Cost?', subtitle: 'Get your custom price quote in less than 1 minute with no obligation.' },
        { id: 'sec_footer', type: 'footer', text: `© ${new Date().getFullYear()} ${wsUpper} PET CARE INC. ALL RIGHTS RESERVED.` }
      ]
    };
  }

  if (isKith) {
    const wsUpper = (storeName || 'KITH').toUpperCase();
    return {
      template: 'kith',
      theme: {
        primary: '#000000',
        secondary: '#E5E5E5',
        background: '#ffffff',
        surface: '#F5F5F5',
        text: '#000000',
        font: 'Inter',
        fontHeading: 'Inter',
      },
      sections: [
        {
          id: 'sec_00_announcement',
          type: 'announcement_bar',
          config: { text: `FREE SHIPPING ON ORDERS OVER $150 · EASY RETURNS · ${wsUpper} DROP LIVE NOW` },
        },
        {
          id: 'sec_01_header_nav',
          type: 'header_nav',
          config: { workspaceName: wsUpper },
        },
        {
          id: 'sec_02_hero_carousel',
          type: 'hero_carousel',
          config: {
            items: [
              { title: `${wsUpper}\nSummer 2026`, subtitle: 'New Delivery', ctaText: 'Shop Now', image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1920&h=960&fit=crop' },
              { title: 'City\nClassics', subtitle: 'Monochrome', ctaText: 'Explore', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=960&fit=crop' },
            ]
          }
        },
        {
          id: 'sec_03_lookbook',
          type: 'lookbook_grid',
          config: {
            images: [
              'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop',
              'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop',
              'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop',
              'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=800&fit=crop'
            ]
          }
        },
        {
          id: 'sec_04_products',
          type: 'product_grid',
          config: {
            title: 'Featured Collection',
            subtitle: `New drops & ${wsUpper} classics`,
          }
        },
        {
          id: 'sec_05_newsletter',
          type: 'newsletter',
          config: { title: 'Join Our List', subtitle: 'Sign up for exclusive access to new releases, sales, and more.' }
        },
        {
          id: 'sec_06_footer',
          type: 'footer',
          config: { text: `© ${new Date().getFullYear()} ${wsUpper} RETAIL LLC. ALL RIGHTS RESERVED.` }
        }
      ]
    };
  }


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

    if (!sections || sections.length < 4 || forcedTemplate === 'kith' || parsed.template === 'kith' || forcedTemplate === 'empire' || parsed.template === 'empire' || forcedTemplate === 'joandso' || parsed.template === 'joandso' || forcedTemplate === 'eql' || parsed.template === 'eql') {
      if (forcedTemplate === 'eql' || parsed.template === 'eql') {
        return createFallbackLayout(storeName, instruction, 'eql');
      }
      if (forcedTemplate === 'joandso' || parsed.template === 'joandso') {
        return createFallbackLayout(storeName, instruction, 'joandso');
      }
      if (forcedTemplate === 'empire' || parsed.template === 'empire') {
        return createFallbackLayout(storeName, instruction, 'empire');
      }
      if (forcedTemplate === 'kith' || parsed.template === 'kith') {
        return createFallbackLayout(storeName, instruction, 'kith');
      }
      if (!sections || sections.length === 0) {
        return createFallbackLayout(storeName, instruction, forcedTemplate);
      }
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
