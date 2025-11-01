# Server Guide - TarAgent Product Categorizer

## 🚀 Quick Start

The server runs on **http://localhost:4310** (VoltAgent's default port).

### Start the Server

```bash
cd C:\tarfwk\tar\taragent
npm run dev
```

You should see:
```
🚀 Initializing VoltAgent Product Categorizer...
🌐 Server running on http://localhost:3141
✅ Custom API endpoints registered

══════════════════════════════════════════════════
  VOLTAGENT SERVER STARTED SUCCESSFULLY
══════════════════════════════════════════════════
  ✓ HTTP Server:  http://localhost:4310
  ✓ Swagger UI:   http://localhost:4310/ui
```

## 📚 API Endpoints

### 1. Health Check
```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:4310/api/health" -Method GET

# Response
{
  "status": "ok",
  "service": "VoltAgent Product Categorizer",
  "version": "1.0.0",
  "timestamp": "2025-10-30T21:37:09.528Z"
}
```

### 2. Categorize Single Product
```bash
# PowerShell
$body = '{"title":"Water Melon Mojito"}'
Invoke-WebRequest -Uri "http://localhost:4310/api/categorize" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content

# curl (if available)
curl -X POST http://localhost:4310/api/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"Water Melon Mojito"}'

# Response
{
  "success": true,
  "data": {
    "title": "Water Melon Mojito",
    "category": "Beverages",
    "confidence": "high",
    "reason": "..."
  }
}
```

### 3. Batch Categorization
```bash
# PowerShell
$body = '{"titles":["iPhone 15","Nike Shoes","Green Tea"]}'
Invoke-WebRequest -Uri "http://localhost:4310/api/categorize/batch" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content

# Response
{
  "success": true,
  "data": [
    {
      "title": "iPhone 15",
      "category": "Electronics",
      "confidence": "high",
      "reason": "..."
    },
    {
      "title": "Nike Shoes",
      "category": "Footwear",
      "confidence": "high",
      "reason": "..."
    },
    {
      "title": "Green Tea",
      "category": "Beverages",
      "confidence": "high",
      "reason": "..."
    }
  ]
}
```

## 🔍 Additional Features

### Swagger UI
Interactive API documentation available at:
**http://localhost:4310/ui**

### VoltOps Console
Monitor your agent's performance at:
**https://console.voltagent.dev**

## 🛠️ Configuration

The server is configured in `src/index.ts`:

```typescript
const voltAgent = new VoltAgent({
  agents: {
    product: productAgent
  },
  server: honoServer({
    port: 3141,              // Note: VoltAgent may use different default
    hostname: "0.0.0.0",     // Bind to all interfaces
    enableSwaggerUI: true,   // Enable Swagger UI
    configureApp: (app) => {
      // Custom endpoints defined here
    }
  })
});
```

## 🧪 Testing

### Test without server:
```bash
npm run test
```

### Test with server running:
```bash
# PowerShell examples above
```

### Test with JavaScript/TypeScript:
```typescript
import { categorizeProduct } from './src/product.js';

const result = await categorizeProduct("Product Title");
console.log(result);
```

## 🔒 Security

- Server binds to `0.0.0.0` (all interfaces) by default
- For production, consider:
  - Adding authentication middleware
  - Using HTTPS/TLS
  - Rate limiting
  - Input validation
  - CORS configuration

## 🐛 Troubleshooting

### Port Already in Use
If port 4310 is already in use, VoltAgent will automatically try another port.

### API Key Issues
Make sure `.env` file has valid API key:
```
GROQ_API_KEY=gsk_your_key_here
```

### Module Not Found
```bash
npm install
```

### TypeScript Errors
```bash
npm run build
```

## 📖 Related Documentation

- [README.md](./README.md) - Main project documentation
- [QUICKSTART.md](./QUICKSTART.md) - Getting started guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [VoltAgent Docs](https://voltagent.dev/docs) - Official framework docs
