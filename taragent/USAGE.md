# TarAgent - Deployment & Usage

## 🚀 Deploy to Cloudflare Workers

### Step 1: Set API Key
```bash
cd C:\tarfwk\tar\taragent
wrangler secret put GROQ_API_KEY
```
When prompted, paste your Groq API key.

### Step 2: Deploy
```bash
npm run worker:deploy
```

You'll get a URL like: `https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev`

## 📱 Use in React Native App

### Update `.env`
```bash
# Add to C:\tarfwk\tar\.env
EXPO_PUBLIC_CATEGORIZER_URL=https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev
```

### Use in productter.tsx

```typescript
// At top of file
const CATEGORIZER_URL = process.env.EXPO_PUBLIC_CATEGORIZER_URL;

// Auto-categorize on product creation
const autoCategorize = async (title: string) => {
  try {
    const response = await fetch(`${CATEGORIZER_URL}/api/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    
    const { category } = await response.json();
    return category;
  } catch (error) {
    console.error('Categorization failed:', error);
    return null;
  }
};

// Use when creating/updating product
if (newProductTitle && !category) {
  const suggestedCategory = await autoCategorize(newProductTitle);
  if (suggestedCategory) {
    updateData.category = suggestedCategory;
  }
}
```

## 🧪 Test Deployed Worker

### Single Product
```bash
curl -X POST https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"cafe frappe"}'

# Response: {"title":"cafe frappe","category":"Beverages"}
```

### Batch
```bash
curl -X POST https://taragent-categorizer.YOUR_SUBDOMAIN.workers.dev/api/categorize/batch \
  -H "Content-Type: application/json" \
  -d '{"titles":["coffee","iphone","shoes"]}'

# Response: [{"title":"coffee","category":"Beverages"}...]
```

## 📊 Performance

- **Edge Network**: Deployed globally, <50ms latency
- **Token Usage**: ~20 tokens per request
- **Cost**: Free tier 100k requests/day
- **Auto-scaling**: Handles traffic spikes automatically

## 🔧 Development

### Local Development
```bash
npm run worker:dev
# Test at http://localhost:8787
```

### Update & Redeploy
```bash
# Edit src/worker.ts
npm run worker:deploy
```

## 🎯 Integration Example

```typescript
// productter.tsx
const handleProductCreate = async (title: string) => {
  // Auto-categorize
  const category = await autoCategorize(title);
  
  // Create product with category
  await db.transact([
    db.tx.products[id()].update({
      title,
      category, // Auto-assigned!
      status: 'active'
    })
  ]);
};
```

## 🔒 Security

- API key stored as Cloudflare secret (encrypted)
- CORS enabled for your app domain
- Rate limiting handled by Cloudflare
- No data stored/logged

## 📈 Monitoring

View logs and metrics:
```bash
wrangler tail taragent-categorizer
```

Or visit: https://dash.cloudflare.com
