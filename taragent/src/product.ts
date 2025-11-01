import { Agent } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";

const getModelConfig = () => {
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    return { model: groq("llama-3.1-8b-instant") };
  }
  if (process.env.OPENAI_API_KEY) {
    return { model: openai("gpt-4o-mini") };
  }
  throw new Error("No API key found");
};

export const productAgent = new Agent({
  name: "ProductCategorizer",
  instructions: 'Categorize product for ecommerce. Return JSON: {"category":"CategoryName"}',
  ...getModelConfig(),
  memory: false,
});

export async function categorizeProduct(title: string) {
  const result = await productAgent.generateText(`Product: "${title}"`);
  
  try {
    const json = JSON.parse(result.text.trim());
    return {
      title,
      category: json.category
    };
  } catch {
    return {
      title,
      category: result.text.trim()
    };
  }
}
