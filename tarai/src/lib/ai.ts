/**
 * AI helpers for product management.
 *
 * Uses the ASI1-mini model via an OpenAI-compatible chat-completions endpoint.
 *
 * SECURITY: a key bundled in a client app is extractable. For production this
 * call should be proxied through a Cloudflare Worker (see docs/architecture/06-ai.md),
 * which also adds the AI Gateway + semantic cache tiers. The inline fallback key
 * exists only so the prototype runs without extra setup.
 */

import { z } from 'zod';

const ASI_ENDPOINT = 'https://inference.asicloud.cudos.org/v1/chat/completions';
const ASI_MODEL = 'asi1-mini';
const ASI_API_KEY =
  process.env.EXPO_PUBLIC_ASI_API_KEY || 'sk-OUW3HRFwVaiN8ySQp0-UPzgbdNdxoaRG9L55MFSmkB8';

export const COMMERCE_CATEGORIES = [
  'Electronics',
  'Clothing & Apparel',
  'Footwear',
  'Food & Beverage',
  'Health & Beauty',
  'Home & Garden',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Stationery',
  'Automotive',
  'Jewelry & Accessories',
  'Pet Supplies',
  'Office Supplies',
  'Furniture',
  'Musical Instruments',
  'Baby & Kids',
  'Industrial & Scientific',
  'Arts & Crafts',
  'Software & Digital',
  'Other',
] as const;

export type CommerceCategory = typeof COMMERCE_CATEGORIES[number];

export const ProductSuggestionSchema = z.object({
  brand: z.string().describe('Best-guess brand, or empty if unknown'),
  category: z.enum(COMMERCE_CATEGORIES).describe('A standard commerce category'),
  description: z.string().describe('One concise product description sentence'),
  tags: z.array(z.string()).max(4).describe('3-4 searchable tags for the product'),
  options: z.array(z.object({
    name: z.string().describe('Option group name, e.g. "Size", "Color", "Flavor"'),
    values: z.array(z.string()).describe('Possible values for this option group'),
  })).max(4).describe('Product option groups like Size, Color. Empty if none.'),
  modifiers: z.array(z.object({
    name: z.string().describe('Modifier name, e.g. "Engraving", "Gift Wrap"'),
    type: z.enum(['text', 'number', 'toggle']).describe('Input type for this modifier'),
    price: z.number().optional().describe('Additional price for this modifier, or 0'),
  })).max(4).describe('Product modifiers/add-ons. Empty if none.'),
  marketing: z.object({
    headline: z.string().describe('Catchy marketing headline, max 10 words'),
    shortDesc: z.string().describe('Short product description for cards, max 15 words'),
    features: z.array(z.string()).max(4).describe('3-4 key product features/bullet points'),
    seoTitle: z.string().describe('SEO meta title, max 60 chars'),
    seoDesc: z.string().describe('SEO meta description, max 160 chars'),
    seoKeywords: z.array(z.string()).max(5).describe('3-5 SEO keywords'),
    socialCaption: z.string().describe('Instagram/social media caption with emojis'),
    badge: z.string().describe('Product badge label: "New", "Best Seller", "Organic", "Premium", "Limited", or empty'),
  }).describe('Marketing and SEO content for the product'),
});

export type ProductSuggestion = z.infer<typeof ProductSuggestionSchema>;

function extractJson(text: string): any {
  console.log(`[AI] extractJson - input length: ${text.length}`);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    console.error(`[AI] extractJson - no JSON object found in: ${text.slice(0, 200)}`);
    throw new Error('No JSON object found in AI response');
  }
  const jsonStr = candidate.slice(start, end + 1);
  console.log(`[AI] extractJson - JSON length: ${jsonStr.length}`);
  return JSON.parse(jsonStr);
}

async function chatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`[AI] chatCompletion - endpoint: ${ASI_ENDPOINT}`);
  console.log(`[AI] chatCompletion - model: ${ASI_MODEL}`);
  console.log(`[AI] chatCompletion - userPrompt: ${userPrompt.slice(0, 100)}`);

  const res = await fetch(ASI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ASI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ASI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  console.log(`[AI] chatCompletion - HTTP status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[AI] HTTP ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  console.log(`[AI] chatCompletion - response keys:`, Object.keys(json));
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  console.log(`[AI] chatCompletion - content length: ${content.length}`);
  if (!content) throw new Error('Empty AI response');
  return content;
}

/**
 * Ask the model to suggest catalogue details for a product title using structured output.
 */
export async function suggestProductDetails(title: string): Promise<ProductSuggestion> {
  console.log(`[AI] suggestProductDetails: "${title}"`);

  const SYSTEM_PROMPT = `You are a product cataloguing assistant for a point-of-sale app.
Given a product title, infer sensible catalogue details.
Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "brand": string,
  "category": one of ${JSON.stringify(COMMERCE_CATEGORIES)},
  "description": string,
  "tags": string[],
  "options": [{ "name": string, "values": string[] }],
  "modifiers": [{ "name": string, "type": "text"|"number"|"toggle", "price": number }],
  "marketing": {
    "headline": string,
    "shortDesc": string,
    "features": string[],
    "seoTitle": string,
    "seoDesc": string,
    "seoKeywords": string[],
    "socialCaption": string,
    "badge": string
  }
}

Rules:
- category must be exactly one of the allowed values
- tags: 3-4 searchable tags for the product
- options: product option groups like Size, Color. Empty array if none.
- modifiers: add-on services like Engraving, Gift Wrap. Empty array if none.
- marketing.headline: catchy marketing headline, max 10 words
- marketing.shortDesc: short product description for cards, max 15 words
- marketing.features: 3-4 key product features/bullet points
- marketing.seoTitle: SEO meta title, max 60 chars
- marketing.seoDesc: SEO meta description, max 160 chars
- marketing.seoKeywords: 3-5 SEO keywords
- marketing.socialCaption: Instagram/social media caption with emojis
- marketing.badge: "New", "Best Seller", "Organic", "Premium", "Limited", or empty string`;

  const content = await chatCompletion(SYSTEM_PROMPT, `Product title: "${title}"`);
  console.log(`[AI] Raw response: ${content.slice(0, 500)}`);
  const parsed = extractJson(content);
  console.log(`[AI] Parsed:`, JSON.stringify(parsed).slice(0, 500));
  return ProductSuggestionSchema.parse(parsed);
}

/**
 * Expand a natural-language instruction into concrete variant labels.
 */
export async function generateVariants(title: string, instruction: string): Promise<string[]> {
  console.log(`[AI] generateVariants: "${title}" / "${instruction}"`);

  const VariantSchema = z.object({
    variants: z.array(z.string()).max(24).describe('Variant labels'),
  });

  const SYSTEM_PROMPT = `You generate product variant option labels for a point-of-sale catalogue.
Given a product title and a free-form instruction, expand it into concrete variant labels.
Examples:
- "sizes 6 to 10" -> ["Size 6","Size 7","Size 8","Size 9","Size 10"]
- "small, medium, large" -> ["Small","Medium","Large"]
- "red and blue in 250ml and 500ml" -> ["Red 250ml","Blue 250ml","Red 500ml","Blue 500ml"]
Respond with ONLY a JSON object: { "variants": string[] }.
Return at most 24 short, human-readable labels. No duplicates, no prose.`;

  const content = await chatCompletion(SYSTEM_PROMPT, `Product title: "${title}"\nInstruction: "${instruction}"`);
  const parsed = extractJson(content);
  const result = VariantSchema.parse(parsed);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of result.variants) {
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= 24) break;
  }
  return out;
}

const SKILL_SYSTEM_PROMPT = `You are a skill generator for a business app. Given a natural-language description of what the user wants to do, generate a skill definition.

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "name": string,
  "description": string,
  "vertical": string,
  "icon": string,           // a valid Ionicons outline icon name, e.g. "document-text-outline"
  "keywords": string[],     // 2-5 natural-language search phrases
  "fields": [               // 1-6 fields the user must fill
    {
      "name": string,       // camelCase identifier
      "label": string,      // human-readable label
      "type": "text"|"number"|"select"|"textarea"|"date"|"phone"|"email"|"rating",
      "required": boolean,
      "placeholder": string,
      "options": string[]   // only for type="select"
    }
  ],
  "creates": {
    "table": "form",
    "formType": string,     // short slug, e.g. "feedback", "attendance"
    "formScope": "p",
    "titleTemplate": string, // e.g. "Visit: {person}" — use {fieldName} placeholders
    "dataFields": string[]  // field names to save into form.data JSON
  }
}

Rules:
- icon must be a real Ionicons outline icon name
- formType should be a short lowercase slug derived from the description
- titleTemplate uses {fieldName} placeholders referencing your field names
- dataFields lists which fields get saved (exclude title-only fields if titleTemplate covers them)
- Return ONLY the JSON object, nothing else`;

/**
 * Ask the model to generate a skill definition from a user's natural-language
 * description. Returns a normalized SkillDef (with `custom: true`, timestamped
 * id, and forced creates.table='form').
 */
export async function generateSkillDefinition(userInput: string): Promise<import('@/skills/definitions').SkillDef> {
  console.log(`[AI] generateSkillDefinition: "${userInput}"`);

  const content = await chatCompletion(SKILL_SYSTEM_PROMPT, userInput);
  const parsed = extractJson(content);

  const VALID_TYPES = new Set(['text', 'number', 'select', 'textarea', 'date', 'phone', 'email', 'rating']);
  const slug = String(parsed.name || 'custom-skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const fields = Array.isArray(parsed.fields)
    ? parsed.fields.map((f: any) => ({
        name: String(f.name || 'field'),
        type: VALID_TYPES.has(f.type) ? f.type : 'text',
        label: String(f.label || f.name || 'Field'),
        required: Boolean(f.required),
        placeholder: String(f.placeholder || ''),
        options: f.type === 'select' && Array.isArray(f.options) ? f.options.map(String) : undefined,
      }))
    : [];

  const titleTemplate = String(parsed.creates?.titleTemplate || '{title}');
  const dataFields = Array.isArray(parsed.creates?.dataFields)
    ? parsed.creates.dataFields.map(String)
    : fields.map((f: any) => f.name);

  const id = `tool_${slug}_${Date.now()}`;

  return {
    id,
    name: String(parsed.name || 'Custom Skill'),
    description: String(parsed.description || ''),
    vertical: String(parsed.vertical || 'general'),
    icon: String(parsed.icon || 'document-text-outline'),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 5) : [],
    fields,
    creates: {
      table: 'form',
      formType: String(parsed.creates?.formType || slug),
      formScope: 'p',
      titleTemplate,
      dataFields,
    },
    custom: true,
  };
}

const SKILL_EDIT_PROMPT = `You are a skill editor for a business app. Given an existing skill definition and a user's edit instruction, modify the skill accordingly.

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "name": string,
  "description": string,
  "vertical": string,
  "icon": string,
  "keywords": string[],
  "fields": [
    {
      "name": string,
      "label": string,
      "type": "text"|"number"|"select"|"textarea"|"date"|"phone"|"email"|"rating",
      "required": boolean,
      "placeholder": string,
      "options": string[]
    }
  ],
  "creates": {
    "table": "form",
    "formType": string,
    "formScope": "p",
    "titleTemplate": string,
    "dataFields": string[]
  }
}

Rules:
- Apply the user's edit instruction to the existing skill
- Keep unchanged parts as-is
- Only modify what the user asked for
- Return ONLY the JSON object, nothing else`;

/**
 * Edit an existing skill definition using AI.
 * Takes the current skill + user's edit instruction, returns modified skill.
 */
export async function editSkillDefinition(
  currentSkill: import('@/skills/definitions').SkillDef,
  editInstruction: string
): Promise<import('@/skills/definitions').SkillDef> {
  console.log(`[AI] editSkillDefinition: "${editInstruction}" on "${currentSkill.name}"`);

  const currentJson = JSON.stringify({
    name: currentSkill.name,
    description: currentSkill.description,
    vertical: currentSkill.vertical,
    icon: currentSkill.icon,
    keywords: currentSkill.keywords,
    fields: currentSkill.fields,
    creates: currentSkill.creates,
  }, null, 2);

  const userPrompt = `Current skill:\n${currentJson}\n\nEdit instruction: ${editInstruction}`;

  const content = await chatCompletion(SKILL_EDIT_PROMPT, userPrompt);
  const parsed = extractJson(content);

  const VALID_TYPES = new Set(['text', 'number', 'select', 'textarea', 'date', 'phone', 'email', 'rating']);

  const fields = Array.isArray(parsed.fields)
    ? parsed.fields.map((f: any) => ({
        name: String(f.name || 'field'),
        type: VALID_TYPES.has(f.type) ? f.type : 'text',
        label: String(f.label || f.name || 'Field'),
        required: Boolean(f.required),
        placeholder: String(f.placeholder || ''),
        options: f.type === 'select' && Array.isArray(f.options) ? f.options.map(String) : undefined,
      }))
    : currentSkill.fields;

  const titleTemplate = String(parsed.creates?.titleTemplate || currentSkill.creates?.titleTemplate || '{title}');
  const dataFields = Array.isArray(parsed.creates?.dataFields)
    ? parsed.creates.dataFields.map(String)
    : currentSkill.creates?.dataFields || fields.map((f: any) => f.name);

  return {
    ...currentSkill,
    name: String(parsed.name || currentSkill.name),
    description: String(parsed.description || currentSkill.description),
    vertical: String(parsed.vertical || currentSkill.vertical),
    icon: String(parsed.icon || currentSkill.icon),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 5) : currentSkill.keywords,
    fields,
    creates: {
      table: 'form',
      formType: String(parsed.creates?.formType || currentSkill.creates?.formType || 'custom'),
      formScope: 'p',
      titleTemplate,
      dataFields,
    },
  };
}
