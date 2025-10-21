import { createGroq } from '@ai-sdk/groq';
import { streamText, UIMessage, convertToModelMessages } from 'ai';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (!process.env.GROQ_API_KEY) {
    return new Response('GROQ_API_KEY is not configured', { status: 500 });
  }

  const result = streamText({
    model: groq('llama-3.1-8b-instant'),
    system:
      'Answer each prompt in one short sentence of at most 20 words. Do not add extra commentary or formatting.',
    messages: convertToModelMessages(messages),
    temperature: 0.2,
    stopSequences: ['\n\n'],
    maxOutputTokens: 48,
  });

  return result.toUIMessageStreamResponse({
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}
