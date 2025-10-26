import { createGroq } from '@ai-sdk/groq';
import { generateText, type UIMessage, convertToCoreMessages } from 'ai';

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

    if (url.pathname !== '/api/chat') {
      console.log('Path not /api/chat, returning 404');
      return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (request.method !== 'POST') {
      console.log('Method not POST, returning 405');
      return new Response('Method not allowed', { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

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
      console.error('Error in Worker:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  },
};
