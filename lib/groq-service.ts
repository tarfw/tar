import * as SecureStore from 'expo-secure-store';

const GROQ_API_KEY_STORE = 'groq_api_key';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * Save the Groq API key to secure storage.
 */
export async function setGroqApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(GROQ_API_KEY_STORE, key);
}

/**
 * Retrieve the stored Groq API key.
 * Checks SecureStore first, then falls back to process.env.EXPO_PUBLIC_GROQ_API_KEY.
 */
export async function getGroqApiKey(): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(GROQ_API_KEY_STORE);
    if (stored) return stored;

    return process.env.EXPO_PUBLIC_GROQ_API_KEY || null;
}

const SYSTEM_PROMPT = `You are a product data assistant. Given a natural language product description, extract structured product metadata as JSON.

Return ONLY valid JSON (no markdown, no backticks) matching this exact schema:

{
  "title": "string — short product title (e.g. 'Nike Air Max 90')",
  "description": "string — rich product description",
  "brand": "string or null",
  "gtin": "string or null",
  "mpn": "string or null",
  "availability": "in stock | out of stock | preorder",
  "price": { "amount": number, "currency": "USD", "range": "string or null" },
  "categorization": { "category": "string", "subcategory": "string or null", "tags": ["string"] },
  "options": [{ "name": "string", "values": ["string"] }],
  "specifications": { "key": "value" },
  "delivery": "string or null",
  "return_policy": "string or null",
  "images": [],
  "universal_code": "string — suggested SKU like PRD-BRAND-001"
}

Rules:
- Always include a concise, descriptive "title"
- Always suggest a "universal_code" (format: PRD-BRANDABBREV-RANDOM3DIGITS)
- Infer reasonable values when the user is vague (e.g. if they say "sneakers" → category: "Footwear")
- Use "USD" as default currency unless stated
- Set availability to "in stock" unless stated otherwise
- Omit null/empty fields from the output
- Keep descriptions concise but informative
- Return ONLY the JSON object, nothing else`;

const REFINE_SYSTEM_PROMPT = `You are a product data assistant. You will receive existing product data as JSON and a user instruction to modify it.

Apply the user's requested changes to the existing data and return the FULL updated JSON object.
Do NOT remove fields that the user did not mention — keep them as-is.
Return ONLY valid JSON (no markdown, no backticks), nothing else.`;

export interface ProductPayload {
    title?: string;
    description?: string;
    brand?: string;
    gtin?: string;
    mpn?: string;
    availability?: string;
    price?: { amount?: number; currency?: string; range?: string };
    categorization?: { category?: string; subcategory?: string; tags?: string[] };
    options?: { name: string; values: string[] }[];
    specifications?: Record<string, string>;
    delivery?: string;
    return_policy?: string;
    images?: string[];
    universal_code?: string;
}

/**
 * Call Groq LLM to generate structured product data from a natural language description.
 */
export async function generateProductPayload(
    userDescription: string
): Promise<ProductPayload> {
    const apiKey = await getGroqApiKey();
    if (!apiKey) {
        throw new Error('Groq API key not configured. Please add it in Settings.');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userDescription },
            ],
            temperature: 0.3,
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
        throw new Error('No response from Groq LLM.');
    }

    // Parse the JSON — strip markdown code fences if present
    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned) as ProductPayload;
}

/**
 * Refine existing product data with a natural language instruction.
 * Sends the current payload + refinement prompt to the LLM.
 */
export async function refineProductPayload(
    currentPayload: ProductPayload,
    refinementInstruction: string
): Promise<ProductPayload> {
    const apiKey = await getGroqApiKey();
    if (!apiKey) {
        throw new Error('Groq API key not configured. Please add it in Settings.');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: REFINE_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Current product data:\n${JSON.stringify(currentPayload, null, 2)}\n\nInstruction: ${refinementInstruction}`,
                },
            ],
            temperature: 0.3,
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
        throw new Error('No response from Groq LLM.');
    }

    const cleaned = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned) as ProductPayload;
}
