import { createGroq } from '@ai-sdk/groq';
import { generateText, type UIMessage, convertToCoreMessages } from 'ai';
import { z } from 'zod';

// Product structured output schema
const ProductSchema = z.object({
  title: z.string().describe('Product title/name'),
  type: z.string().describe('Product type/category'),
  img: z.string().url().optional().describe('Primary product image URL'),
  medias: z.array(z.string().url()).optional().describe('Additional media URLs'),
  notes: z.string().optional().describe('Product notes/description'),
  options: z.record(z.union([
    z.array(z.string()), // Simple options like ["Red", "Blue"]
    z.array(z.tuple([z.string(), z.string()])) // Options with identifiers like [["Red", "#FF0000"]]
  ])).optional().describe('Product options/variants')
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    console.log('Request received:', request.method, new URL(request.url).pathname);
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (url.pathname !== '/api/chat' && url.pathname !== '/api/products/generate') {
      console.log('Path not supported, returning 404');
      return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (request.method !== 'POST') {
      console.log('Method not POST, returning 405');
      return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (url.pathname === '/api/chat') {
      try {
        console.log('Parsing request JSON...');
        const body = await request.json();
        console.log('Body:', body);
        const coreMessages = body.messages;
        console.log('Core messages:', coreMessages);

        const groq = createGroq({
          apiKey: env.GROQ_API_KEY,
        });

        console.log('Generating text...');
        const result = await generateText({
          model: groq('llama-3.1-8b-instant'),
          messages: coreMessages,
        });

        console.log('Text generated:', result.text.substring(0, 50));
        return new Response(JSON.stringify({ text: result.text }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        });
      } catch (error) {
        console.error('Error in chat:', error);
        return new Response('Internal Server Error', {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    } else if (url.pathname === '/api/products/generate') {
      try {
        console.log('Parsing products request JSON...');
        const body = await request.json();
        console.log('Body:', body);
        const { messages, existingProduct } = body;
        console.log('Messages:', messages);

        const groq = createGroq({
          apiKey: env.GROQ_API_KEY,
        });

        const systemPrompt = `You are a product modification assistant. Only make the specific changes requested by the user.
        ${existingProduct ? `Start with the existing product: ${JSON.stringify(existingProduct)}` : 'Create a new product from scratch.'}
        Do NOT add extra options, examples, suggestions, or modifications beyond what is explicitly requested.
        Do NOT change existing data unless specifically asked to.
        Only output the modified product data in JSON format within code blocks.
        IMPORTANT: Options must be an object where keys are option group names (like "Color", "Size", "Material") and values are arrays of [label, identifier] pairs.
        Example: {"Color": [["Red", "#FF0000"], ["Blue", "#0000FF"]], "Size": [["Small", "S"], ["Medium", "M"]]}
        For color options, ALWAYS use proper hex color codes (like #FF0000 for red) as the identifier.
        For other options, use appropriate identifiers (short codes or abbreviations like S, M, L for sizes).`;

        console.log('Generating structured product data...');
        const result = await generateText({
          model: groq('llama-3.1-8b-instant'),
          messages: [
            { role: 'system', content: systemPrompt },
            ...convertToCoreMessages(messages)
          ],
          output: ProductSchema,
        });

        console.log('Structured product generated:', result.structured);
        console.log('Full result:', result);

        const productData = result.structured || null;

        return new Response(JSON.stringify({
          product: productData,
          text: result.text
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        });
      } catch (error) {
        console.error('Error generating product:', error);
        return new Response(JSON.stringify({
          error: 'Failed to generate product',
          details: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
  },
};
