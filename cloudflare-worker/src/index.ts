import { Agent, InMemoryStorageAdapter, Memory } from "@voltagent/core";
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

// Type for Cloudflare Worker environment
type Env = {
  GROQ_API_KEY: string;
};

// Product schema for structured generation
const ProductSchema = z.object({
  title: z.string().describe('Product title/name'),
  category: z.string().optional().describe('Product category'),
  img: z.string().url().optional().describe('Primary product image URL'),
  status: z.string().optional().describe('Product status'),
  supplier: z.string().optional().describe('Product supplier'),
  options: z.record(z.union([
    z.array(z.string()),
    z.array(z.tuple([z.string(), z.string()]))
  ])).optional().describe('Product options/variants')
});

// Helper functions for product generation
function generateOptionCombinations(options: Record<string, any>): string[][] {
  if (!options || Object.keys(options).length === 0) {
    return [[]];
  }

  const optionEntries = Object.entries(options);
  const combinations: string[][] = [[]];

  for (const [groupName, values] of optionEntries) {
    const newCombinations: string[][] = [];
    for (const combination of combinations) {
      for (const value of values) {
        const optionString = Array.isArray(value) ? `${groupName}:${value[0]}(${value[1]})` : `${groupName}:${value}`;
        newCombinations.push([...combination, optionString]);
      }
    }
    combinations.length = 0;
    combinations.push(...newCombinations);
  }

  return combinations;
}

// Generate professional SKUs using AI
async function generateSKUs(product: any, variants: Array<{ option: string }>, apiKey: string): Promise<string[]> {
  const groq = createGroq({
    apiKey: apiKey,
  });

  const skuPrompt = `Generate professional, human-friendly, readable SKU codes for the following product variants.

Product: ${product.title}
Category: ${product.category || 'General'}
Supplier: ${product.supplier || 'Generic'}
Number of variants: ${variants.length}

Variants to generate SKUs for:
${variants.map((v, i) => `${i + 1}. ${v.option || 'Default'}`).join('\n')}

CRITICAL RULES for SKU generation:
- MUST be human-readable and easy to understand at a glance
- Use clear, descriptive abbreviations (3-5 letters per segment)
- Use color NAMES only (RED, BLUE, BLACK, WHITE, etc.) - NEVER use hex codes like #FF0000
- Use size codes that make sense (S, M, L, XL or SMALL, MEDIUM, LARGE)
- Separate segments with hyphens for readability
- Keep total length between 8-15 characters
- All uppercase for consistency
- Each SKU must be unique for its variant
- Follow industry standard formats

Good SKU Examples:
- TSHIRT-RED-MEDIUM (T-Shirt, Red color, Medium size)
- JEANS-BLUE-32W-34L (Jeans, Blue, 32 waist, 34 length)
- SHOES-BLACK-SIZE10 (Shoes, Black color, Size 10)
- JACKET-GRAY-LARGE (Jacket, Gray color, Large)
- PHONE-SILVER-128GB (Phone, Silver, 128GB storage)

Bad SKU Examples (DO NOT USE):
- TSH-#FF0000-M (contains hex color code - WRONG!)
- PROD-001-V2 (not descriptive - WRONG!)
- tshirt-red-m (lowercase - WRONG!)

Output format: Return ONLY a JSON array of SKU strings, one for each variant in order.
Example: ["TSHIRT-RED-SMALL", "TSHIRT-RED-MEDIUM", "TSHIRT-BLUE-SMALL", "TSHIRT-BLUE-MEDIUM"]

JSON array of ${variants.length} human-readable SKUs:`;

  try {
    // Create a temporary agent for SKU generation
    const skuAgent = new Agent({
      name: "sku-generator",
      instructions: "You generate professional SKU codes in JSON array format only.",
      model: groq('llama-3.1-8b-instant'),
      memory: false,
    });

    const result = await skuAgent.generateText(skuPrompt);
    
    // Extract JSON array from response
    const jsonMatch = result.text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      throw new Error('No SKU array found in response');
    }
    
    const skus = JSON.parse(jsonMatch[0]);
    
    // Validate we got the right number of SKUs
    if (!Array.isArray(skus) || skus.length !== variants.length) {
      throw new Error(`Expected ${variants.length} SKUs, got ${skus.length}`);
    }
    
    return skus;
  } catch (error) {
    console.error('AI SKU generation failed, using fallback:', error);
    // Fallback to human-readable SKU generation if AI fails
    const baseTitle = product.title?.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(' ')[0].substring(0, 8) || 'PRODUCT';
    
    return variants.map((variant, i) => {
      // Extract readable parts from variant option
      const optionParts = variant.option.split(' ')
        .map(part => {
          // Remove hex codes and parentheses, keep only readable text
          const cleaned = part.replace(/\(#[A-F0-9]{6}\)/gi, '')
                             .replace(/[():]/g, '')
                             .split(':')[1] || part;
          return cleaned.toUpperCase().substring(0, 8);
        })
        .filter(part => part.length > 0)
        .slice(0, 2); // Max 2 option parts for readability
      
      return optionParts.length > 0 
        ? `${baseTitle}-${optionParts.join('-')}`
        : `${baseTitle}-VAR${i + 1}`;
    });
  }
}

async function generateItemsFromProduct(product: any, apiKey: string): Promise<any[]> {
  if (!product.options) {
    // Generate single SKU for product without variants
    const skus = await generateSKUs(product, [{ option: 'Default' }], apiKey);
    return [{
      sku: skus[0],
      option: null,
      price: null,
      cost: null,
      barcode: null,
      image: product.img || null,
      attribute: {}
    }];
  }

  const combinations = generateOptionCombinations(product.options);
  const variants = combinations.map(combination => ({
    option: combination.join(' ')
  }));

  // Generate AI-powered SKUs for all variants
  const skus = await generateSKUs(product, variants, apiKey);

  return combinations.map((combination, index) => {
    const optionString = combination.join(' ');

    return {
      sku: skus[index],
      option: optionString || null,
      price: null,
      cost: null,
      barcode: null,
      image: product.img || null,
      attribute: {}
    };
  });
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware
app.use('/*', cors());

// Initialize agents globally (will be created per request in Workers)
let chatAgent: Agent<any>;
let productAgent: Agent<any>;

// Initialize agents with env
function initializeAgents(env: Env) {
  const groq = createGroq({
    apiKey: env.GROQ_API_KEY,
  });

  // In-memory storage for Cloudflare Workers
  const memory = new Memory({
    storage: new InMemoryStorageAdapter(),
  });

  // Chat Agent - handles general conversations
  chatAgent = new Agent({
    name: "chat-assistant",
    instructions: "You are a helpful assistant that answers questions clearly and concisely.",
    model: groq('llama-3.1-8b-instant'),
    memory, // Enable memory for conversations
  });

  // Product Generation Agent - handles product creation with structured output
  productAgent = new Agent({
    name: "product-generator",
    instructions: `You create and modify product data structures. Generate complete product information including:
- title: Product name
- category: Product category
- img: Image URL (optional)
- status: Product status (e.g., "active", "draft")
- supplier: Supplier name (optional)
- options: Variants as key-value pairs where values are arrays of [label, identifier] tuples
  - For colors: use hex codes as identifiers (e.g., [["Red", "#FF0000"], ["Blue", "#0000FF"]])
  - For sizes/other: use short codes (e.g., [["Small", "S"], ["Medium", "M"]])

Always output ONLY valid JSON matching the product schema. No markdown, no explanations.`,
    model: groq('llama-3.1-8b-instant'),
    memory: false,
  });
}

// Chat endpoint
app.post('/api/chat', async (c) => {
  try {
    const env = c.env;
    if (!chatAgent) initializeAgents(env);

    const body = await c.req.json();
    const { messages } = body;

    console.log('Chat request:', { messageCount: messages?.length });

    const result = await chatAgent.generateText(messages);

    return c.json({ text: result.text });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return c.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, 500);
  }
});

// Product generation endpoint
app.post('/api/products/generate', async (c) => {
  try {
    const env = c.env;
    if (!productAgent) initializeAgents(env);

    const body = await c.req.json();
    const { messages, existingProduct } = body;

    console.log('Product generation request:', { 
      messageCount: messages?.length, 
      hasExisting: !!existingProduct 
    });

    // Build system prompt
    const systemPrompt = `You are a JSON-only product creation assistant. You MUST output ONLY a valid, complete JSON object.

${existingProduct ? `Modify this existing product: ${JSON.stringify(existingProduct)}` : 'Create a new product from scratch'}

REQUIRED OUTPUT FORMAT: A single complete JSON object with these exact fields:
- title: string (required)
- category: string (optional)
- img: string (optional)
- status: string (optional)
- supplier: string (optional)
- options: object where keys are option names and values are arrays of [label, identifier] pairs

CRITICAL RULES FOR OPTIONS:
1. Each option MUST be exactly a 2-element array: [label, identifier]
2. Format: [["Option Name", "CODE"], ["Another Name", "CODE2"]]
3. Each pair has EXACTLY 2 strings - no more, no less
4. For colors: use text codes like "RED", "BLUE", "BLACK" - NEVER hex codes
5. For sizes: use "S", "M", "L", "XL" or "SMALL", "MEDIUM", "LARGE"
6. For other options: use short uppercase codes (2-6 letters)
7. NO special characters or hex codes in identifiers

CORRECT OPTION FORMAT:
"options": {
  "Size": [["Small", "S"], ["Medium", "M"], ["Large", "L"]],
  "Color": [["Red", "RED"], ["Blue", "BLUE"]],
  "Glass": [["Highball", "HB"], ["Tall", "TG"]]
}

WRONG FORMATS (DO NOT USE):
❌ "Glass": [["Highball","HB"],["Tall","TG","Tallest","TJ"]]  <- TOO MANY elements in second array!
❌ "Color": [["Red","#FF0000"]]  <- Hex code!
❌ "Size": [["Small"]]  <- Only 1 element, need 2!

COMPLETE GOOD EXAMPLE:
{"title":"Water Melon Mojito","category":"Beverages","options":{"Size":[["Regular","REG"],["Large","LRG"]],"Glass":[["Highball","HB"],["Tall","TG"]],"Topping":[["Mint","MINT"],["Garnish","GRNS"]]},"status":"active","supplier":"FreshMix"}

OUTPUT RULES:
1. Output ONLY the JSON object - no explanations, no code blocks, no markdown
2. JSON MUST be complete with all opening/closing braces and brackets
3. Each option array element MUST have exactly 2 strings

Make sure your JSON is COMPLETE and VALID before outputting.`;

    // Use generateText instead of generateObject (Groq llama-3.1-8b-instant doesn't support structured outputs)
    const result = await productAgent.generateText([
      { role: 'system', content: systemPrompt },
      ...messages
    ]);

    // Parse the JSON from text response with robust error handling
    let productData;
    try {
      let jsonText = result.text.trim();
      
      // Try to extract JSON from the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      jsonText = jsonMatch[0];
      
      // Attempt to fix common JSON issues
      // 1. Remove trailing quotes or commas
      jsonText = jsonText.replace(/,\s*$/, '').replace(/"\s*$/, '');
      
      // 2. Try to complete incomplete JSON by adding missing closing braces
      const openBraces = (jsonText.match(/\{/g) || []).length;
      const closeBraces = (jsonText.match(/\}/g) || []).length;
      const openBrackets = (jsonText.match(/\[/g) || []).length;
      const closeBrackets = (jsonText.match(/\]/g) || []).length;
      
      // Add missing closing brackets
      for (let i = 0; i < (openBrackets - closeBrackets); i++) {
        jsonText += ']';
      }
      // Add missing closing braces
      for (let i = 0; i < (openBraces - closeBraces); i++) {
        jsonText += '}';
      }
      
      // Parse the JSON
      productData = JSON.parse(jsonText);
      
      // Clean up options to ensure each is a 2-element array [label, identifier]
      if (productData.options) {
        for (const [optionKey, optionValues] of Object.entries(productData.options)) {
          if (Array.isArray(optionValues)) {
            // Fix each option array - ensure it's [label, code] format
            productData.options[optionKey] = optionValues.map((item: any) => {
              if (Array.isArray(item)) {
                // If array has more than 2 elements, take only first 2
                if (item.length > 2) {
                  console.warn(`Option ${optionKey} has ${item.length} elements, truncating to 2:`, item);
                  return [item[0], item[1]];
                }
                // If array has less than 2, pad with uppercase version of label
                if (item.length === 1) {
                  return [item[0], item[0].toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)];
                }
                return item;
              }
              // If not an array, convert to proper format
              return [String(item), String(item).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)];
            });
          }
        }
      }
      
      // Validate against schema
      ProductSchema.parse(productData);
      
      console.log('Product parsed successfully:', { 
        title: productData.title,
        hasOptions: !!productData.options,
        optionCount: productData.options ? Object.keys(productData.options).length : 0
      });
      
    } catch (parseError: any) {
      console.error('Failed to parse product JSON:', parseError);
      console.error('Raw text:', result.text);
      
      // Try a second attempt with more aggressive cleaning
      try {
        let cleanText = result.text.trim();
        // Remove any markdown formatting
        cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        // Extract first complete-looking JSON object
        const simpleMatch = cleanText.match(/(\{[^{}]*\})/);
        if (simpleMatch) {
          productData = JSON.parse(simpleMatch[0]);
          ProductSchema.parse(productData);
          console.log('Product parsed on retry:', productData.title);
        } else {
          throw new Error('Could not extract valid JSON after retry');
        }
      } catch (retryError) {
        return c.json({
          error: 'Failed to parse product data',
          details: parseError.message,
          rawText: result.text.substring(0, 500) // Truncate for safety
        }, 500);
      }
    }

    const itemsData = await generateItemsFromProduct(productData, env.GROQ_API_KEY);

    console.log('Product generated:', { 
      title: productData.title,
      variantCount: itemsData.length,
      sampleSKU: itemsData[0]?.sku 
    });

    return c.json({
      product: productData,
      items: itemsData,
      text: JSON.stringify(productData)
    });

  } catch (error: any) {
    console.error('Error generating product:', error);
    return c.json({
      error: 'Failed to generate product',
      details: error.message
    }, 500);
  }
});

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'VoltAgent Cloudflare Worker',
    endpoints: ['/api/chat', '/api/products/generate']
  });
});

// Export for Cloudflare Workers
export default app;
