import { createGroq } from '@ai-sdk/groq';
import { streamText, type UIMessage, convertToCoreMessages } from 'ai';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: groq('llama-3.1-8b-instant'),
    messages: convertToCoreMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}
