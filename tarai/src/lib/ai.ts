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
