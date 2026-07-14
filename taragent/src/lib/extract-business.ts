/**
 * Business Info Extraction — AI extracts structured business data from a user message.
 *
 * One message → name, type, location, description, hours, products, services, policies, FAQs, brand.
 * Used during workspace creation to auto-populate everything from a natural language description.
 */

export interface ExtractedBusiness {
  name: string;
  type: string;
  location: string;
  description: string;
  hours: string;
  products: Array<{ name: string; price: number; description: string }>;
  services: Array<{ name: string; price: number; description: string }>;
  policies: { return: string; delivery: string };
  faqs: Array<{ q: string; a: string }>;
  brand_color: string | null;
  typography: { heading: string | null; body: string | null };
}

const EXTRACTION_PROMPT = `Extract business information from this message. Return ONLY valid JSON, no markdown fences, no explanation.

Message:
"{message}"

Return JSON:
{
  "name": "business name",
  "type": "restaurant|salon|clinic|retail|gym|agency|freelancer|other",
  "location": "city/area or empty string",
  "description": "what the business does (1 sentence)",
  "hours": "opening hours or empty string",
  "products": [{ "name": "item", "price": 0, "description": "" }],
  "services": [{ "name": "service", "price": 0, "description": "" }],
  "policies": { "return": "", "delivery": "" },
  "faqs": [{ "q": "", "a": "" }],
  "brand_color": "#hex or null",
  "typography": { "heading": "font name or null", "body": "font name or null" }
}

Rules:
- Extract ONLY what's explicitly stated. Don't invent products/services.
- If price is mentioned as "₹22", use 22. If no price, use 0.
- If no brand color mentioned, use null.
- If no typography mentioned, use null for both.
- Empty arrays for products/services/faqs if nothing mentioned.
- Keep policies empty strings if not mentioned.`;

async function callLLM(prompt: string, env: any): Promise<string> {
  // Try Cloudflare Workers AI first
  const cfAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = env.CLOUDFLARE_API_TOKEN;

  if (cfAccountId && cfApiToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/zai-org/glm-4.7-flash`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        }
      );

      if (res.ok) {
        const data = await res.json() as any;
        const content = data?.result?.response || data?.result?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err) {
      console.warn('[extract-business] Workers AI failed, falling back to Groq:', err);
    }
  }

  // Fallback: Groq
  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) throw new Error('No LLM API configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return content;
}

function parseLLMOutput(raw: string): unknown {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in LLM output');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateAndDefault(data: any): ExtractedBusiness {
  return {
    name: String(data?.name || 'My Business'),
    type: String(data?.type || 'business'),
    location: String(data?.location || ''),
    description: String(data?.description || ''),
    hours: String(data?.hours || ''),
    products: Array.isArray(data?.products) ? data.products.map((p: any) => ({
      name: String(p?.name || ''),
      price: Number(p?.price) || 0,
      description: String(p?.description || ''),
    })) : [],
    services: Array.isArray(data?.services) ? data.services.map((s: any) => ({
      name: String(s?.name || ''),
      price: Number(s?.price) || 0,
      description: String(s?.description || ''),
    })) : [],
    policies: {
      return: String(data?.policies?.return || ''),
      delivery: String(data?.policies?.delivery || ''),
    },
    faqs: Array.isArray(data?.faqs) ? data.faqs.map((f: any) => ({
      q: String(f?.q || ''),
      a: String(f?.a || ''),
    })) : [],
    brand_color: data?.brand_color || null,
    typography: {
      heading: data?.typography?.heading || null,
      body: data?.typography?.body || null,
    },
  };
}

/**
 * Extract business info from a user's natural language message.
 */
export async function extractBusinessInfo(
  message: string,
  env: any
): Promise<ExtractedBusiness> {
  const prompt = EXTRACTION_PROMPT.replace('{message}', message);
  const raw = await callLLM(prompt, env);
  const parsed = parseLLMOutput(raw);
  return validateAndDefault(parsed);
}
