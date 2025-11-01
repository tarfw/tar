import "dotenv/config";
import { VoltAgent } from "@voltagent/core";
import honoServer from "@voltagent/server-hono";
import { productAgent, categorizeProduct } from "./product.js";

// Initialize VoltAgent framework with HTTP server
const voltAgent = new VoltAgent({
  agents: {
    product: productAgent
  },
  server: honoServer({
    port: 3141,
    hostname: "0.0.0.0",
    enableSwaggerUI: true,
    configureApp: (app) => {
      app.post("/api/categorize", async (c) => {
        try {
          const { title } = await c.req.json();
          if (!title) return c.json({ error: "title required" }, 400);

          const result = await categorizeProduct(title);
          return c.json(result);
        } catch (error: any) {
          return c.json({ error: error.message }, 500);
        }
      });

      app.post("/api/categorize/batch", async (c) => {
        try {
          const { titles } = await c.req.json();
          if (!Array.isArray(titles)) return c.json({ error: "titles array required" }, 400);

          const results = await Promise.all(titles.map(categorizeProduct));
          return c.json(results);
        } catch (error: any) {
          return c.json({ error: error.message }, 500);
        }
      });

      app.get("/api/health", (c) => c.json({ status: "ok" }));
    }
  })
});

export { voltAgent, productAgent, categorizeProduct };
