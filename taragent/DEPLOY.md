# Deploy TarAgent to Cloudflare Workers

## Quick Deploy

### 1. Install Dependencies
```bash
npm install
```

### 2. Set API Key Secret
```bash
wrangler secret put GROQ_API_KEY
# Paste your Groq API key when prompted
```

### 3. Deploy
```bash
npm run worker:deploy
```

### 4. Test Deployment
```bash
# Replace with your worker URL
curl -X POST https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"cafe frappe"}'
```

## Development

### Run Locally
```bash
npm run worker:dev
```

### Test Local Worker
```bash
curl -X POST http://localhost:8787/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"cafe frappe"}'
```

## Endpoints

### Single Product
```
POST /api/categorize
Body: {"title":"product name"}
Response: {"title":"product name","category":"CategoryName"}
```

### Batch
```
POST /api/categorize/batch
Body: {"titles":["product1","product2"]}
Response: [{"title":"product1","category":"Cat1"},...]
```

### Health Check
```
GET /api/health
Response: {"status":"ok"}
```

## Integration with App

Update your `.env`:
```
EXPO_PUBLIC_CATEGORIZER_URL=https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev
```

Use in React Native:
```typescript
const response = await fetch(`${process.env.EXPO_PUBLIC_CATEGORIZER_URL}/api/categorize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: productTitle })
});
const { category } = await response.json();
```

## Production Notes

- Worker runs on edge (fast globally)
- ~20 tokens per categorization
- Groq free tier: 14,400 requests/day
- Auto-scales with traffic
