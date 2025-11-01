import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

type Env = {
  GROQ_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

app.post('/api/categorize', async (c) => {
  try {
    const { title } = await c.req.json();
    if (!title) return c.json({ error: "title required" }, 400);

    const groq = createGroq({ apiKey: c.env.GROQ_API_KEY });
    
    const result = await generateText({
      model: groq('llama-3.1-8b-instant'),
      prompt: `Categorize for ecommerce: "${title}". Reply ONLY with category name, nothing else.`,
    });

    return c.json({ title, category: result.text.trim() });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/categorize/batch', async (c) => {
  try {
    const { titles } = await c.req.json();
    if (!Array.isArray(titles)) return c.json({ error: "titles array required" }, 400);

    const groq = createGroq({ apiKey: c.env.GROQ_API_KEY });

    const results = await Promise.all(
      titles.map(async (title) => {
        const result = await generateText({
          model: groq('llama-3.1-8b-instant'),
          prompt: `Categorize for ecommerce: "${title}". Reply ONLY with category name, nothing else.`,
        });
        return { title, category: result.text.trim() };
      })
    );

    return c.json(results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/api/health', (c) => c.json({ status: "ok" }));

export default app;
