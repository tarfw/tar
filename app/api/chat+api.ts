import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Get API key from environment (server-side)
    const apiKey = process.env.GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY;

    if (!apiKey || apiKey.includes('your_groq_') || apiKey.length < 20) {
      console.error('Invalid Groq API key in server route');
      return new Response(JSON.stringify({ error: 'API configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Groq with API key
    const groqClient = groq({
      apiKey: apiKey,
    });

    const result = await generateText({
      model: groqClient('gemma2-9b-it'),
      messages,
      maxTokens: 1000,
    });

    return new Response(JSON.stringify({ content: result.text }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
