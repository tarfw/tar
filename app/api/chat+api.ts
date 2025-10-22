import { createGroq } from '@ai-sdk/groq';
import { streamText, type UIMessage } from 'ai';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const normalizeMessages = (body: unknown): UIMessage[] => {
  const payload = body as {
    messages?: unknown;
    message?: unknown;
  };

  if (Array.isArray(payload?.messages)) {
    return [...(payload.messages as UIMessage[])];
  }

  const messageText =
    typeof payload?.message === 'string'
      ? payload.message
      : typeof (payload?.message as { text?: unknown })?.text === 'string'
        ? (payload.message as { text: string }).text
        : undefined;

  if (messageText && messageText.trim()) {
    return [
      {
        id: `user-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text', text: messageText.trim() }],
      } as UIMessage,
    ];
  }

  return [];
};

export async function POST(req: Request) {
  const body = await req.json();
  const messages = normalizeMessages(body);

  if (!messages.length) {
    return new Response('No messages provided', { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return new Response('GROQ_API_KEY is not configured', { status: 500 });
  }

  const result = streamText({
    model: groq('llama-3.1-8b-instant'),
    system:
      'Answer each prompt in one short sentence of at most 20 words. Do not add extra commentary or formatting.',
    messages,
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
