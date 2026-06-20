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

const ASI_ENDPOINT = 'https://inference.asicloud.cudos.org/v1/chat/completions';
const ASI_MODEL = 'asi1-mini';
const ASI_API_KEY =
  process.env.EXPO_PUBLIC_ASI_API_KEY || 'sk-OUW3HRFwVaiN8ySQp0-UPzgbdNdxoaRG9L55MFSmkB8';

export interface ProductSuggestion {
  brand: string;
  category: string;
  description: string;
  variants: string[];
}

const SYSTEM_PROMPT = `You are a product cataloguing assistant for a point-of-sale app.
Given a product title, infer sensible catalogue details.
Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "brand": string,        // best-guess brand, or "" if unknown
  "category": string,     // a single broad category, e.g. "Footwear", "Beverage"
  "description": string,  // one concise sentence
  "variants": string[]    // 0-8 sensible variant option labels, e.g. ["Size 7","Size 8"] or ["Small","Medium","Large"]. Empty array if the product has no natural variants.
}`;

/** Extract the first JSON object from a model response that may be wrapped in prose/markdown. */
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

/**
 * Ask the model to suggest catalogue details for a product title.
 * Throws on network / parse errors so the caller can show a retry.
 */
export async function suggestProductDetails(title: string): Promise<ProductSuggestion> {
  console.log(`[AI] suggestProductDetails: "${title}"`);

  const res = await fetch(ASI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ASI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ASI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Product title: "${title}"` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(`[AI] HTTP ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty AI response');

  const parsed = extractJson(content);

  return {
    brand: typeof parsed.brand === 'string' ? parsed.brand.trim() : '',
    category: typeof parsed.category === 'string' ? parsed.category.trim() : '',
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    variants: Array.isArray(parsed.variants)
      ? parsed.variants.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0).map((v: string) => v.trim()).slice(0, 8)
      : [],
  };
}

const VARIANT_SYSTEM_PROMPT = `You generate product variant option labels for a point-of-sale catalogue.
Given a product title and a free-form instruction, expand it into concrete variant labels.
Examples:
- "sizes 6 to 10" -> ["Size 6","Size 7","Size 8","Size 9","Size 10"]
- "small, medium, large" -> ["Small","Medium","Large"]
- "red and blue in 250ml and 500ml" -> ["Red 250ml","Blue 250ml","Red 500ml","Blue 500ml"]
Respond with ONLY a JSON object: { "variants": string[] }.
Return at most 24 short, human-readable labels. No duplicates, no prose.`;

/**
 * Expand a natural-language instruction into concrete variant labels.
 * Throws on network / parse errors so the caller can show a retry.
 */
export async function generateVariants(title: string, instruction: string): Promise<string[]> {
  console.log(`[AI] generateVariants: "${title}" / "${instruction}"`);

  const res = await fetch(ASI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ASI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ASI_MODEL,
      messages: [
        { role: 'system', content: VARIANT_SYSTEM_PROMPT },
        { role: 'user', content: `Product title: "${title}"\nInstruction: "${instruction}"` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(`[AI] HTTP ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty AI response');

  const parsed = extractJson(content);
  if (!Array.isArray(parsed.variants)) return [];

  // De-dupe case-insensitively, trim, cap at 24.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of parsed.variants) {
    if (typeof v !== 'string') continue;
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
 * Throws on network / parse errors so the caller can show a retry.
 */
export async function generateSkillDefinition(userInput: string): Promise<import('@/skills/definitions').SkillDef> {
  console.log(`[AI] generateSkillDefinition: "${userInput}"`);

  const res = await fetch(ASI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ASI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ASI_MODEL,
      messages: [
        { role: 'system', content: SKILL_SYSTEM_PROMPT },
        { role: 'user', content: userInput },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(`[AI] HTTP ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Empty AI response');

  const parsed = extractJson(content);

  // Normalize and validate
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
