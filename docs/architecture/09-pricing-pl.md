# 09 — Pricing, Cost & P&L

Operating economics of the Cloudflare Workers + Durable Objects model vs Turso Cloud.

Moving from Turso replication to **DO SQLite (with Hibernation)** bypasses Turso Scale bandwidth fees. The 20:1 WebSocket discount keeps edge costs minimal. Turso is retained only as the lightweight global AI/memory index.

---

## 1. Sync cost (100k scopes, 80M writes, 400M reads)

| Component | Turso Scale (USD) | Durable Objects (USD) | Notes |
| :--- | :--- | :--- | :--- |
| Base plan | 29.00 | 5.00 | Turso Scaler vs CF Workers Paid |
| Active DB overage | 0.00 | 0.00 | both zero |
| Worker requests | included | 7.65 | 54M req (3M free, then $0.15/M) |
| DO CPU (hibernation) | n/a | 0.00 | under 390k GB-s free tier |
| Sync egress / WS | 2,394.00 | included | Turso 9.6TB vs CF zero-egress |
| Active SQLite storage | 88.00 | 39.00 | 200GB vs 5GB free + $0.20/GB |
| SQL rows r/w | included | 80.40 | 400M read + 80M write |
| Backend KV I/O | included | 160.00 | 400M + 80M units |
| Archival (R2/S3) | 3.00 | 3.00 | ledger archives |
| **Total** | **2,514.00** | **295.05** | **~₹2,10,000 vs ~₹24,800 / mo** |

*(A leaner profile — fewer KV ops — lands near ~$62/mo; see [02-sync-protocol.md §6](02-sync-protocol.md#6-cost-do-sqlite--hibernation-100k-scopes). The $295 figure above is the conservative all-in estimate including KV I/O.)*

---

## 2. Monthly P&L (100k collab users)

| Category | USD | INR | Margin |
| :--- | :--- | :--- | :--- |
| Gross revenue | 634,730 | 5,30,00,000 | 100% (₹500/mo tier) |
| DB sync (CF DO) | 295 | 24,800 | 0.05% |
| Hosting & gateway | 50 | 4,200 | 0.01% |
| AI LLM queries | 11,976 | 10,00,000 | 1.89% |
| **Total expenses** | **12,321** | **10,29,000** | **1.94%** |
| **Net profit** | **622,409** | **5,19,71,000** | **98.06%** |

---

## 3. AI capacity (₹10,00,000 / mo pooled)

Pooled global budget, not per-user quotas. Average query ≈ 1,000 input + 200 output tokens.

| Model | Pricing (in / out per 1M) | Cost/query | Monthly capacity |
| :--- | :--- | :--- | :--- |
| DeepSeek-V3 | $0.14 / $0.28 | $0.000196 | ~61M queries |
| Gemini 2.0 Flash | $0.10 / $0.40 | $0.000180 | ~66.5M queries |

- 100k users → **610–660 queries/user/mo** (~20/day). Heavy merchants use more; casual users balance out.
- Prompt caching (DeepSeek/Gemini) cuts input cost 50–90% → capacity past **100M queries/mo**.
- AI is only **1.89%** of gross revenue.

---

## 4. Classification cache savings

Separate from LLM query budget — see [06-ai-classification-cache.md §6](06-ai-classification-cache.md#6-cost-at-scale-1m-classificationsmo). Semantic caching cuts product-classification LLM cost ~73% ($300 → $81 per 1M classifications).
