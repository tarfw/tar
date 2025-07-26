import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Initialize Groq with API key
    const groqClient = groq({
      apiKey: process.env.GROQ_API_KEY,
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
