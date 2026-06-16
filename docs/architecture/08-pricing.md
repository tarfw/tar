# 09 — Pricing, Cost & P&L

Economics of the Cloudflare Workers + DO model.

---

## 1. Sync Cost (100k Scopes)

| Component | Turso Scale | DO SQLite | Notes |
|:----------|:------------|:----------|:------|
| Base plan | $29 | $5 | |
| Worker requests | included | $12 | 54M req |
| DO CPU | n/a | $0 | free tier |
| Sync egress | $2,394 | **$0** | zero-egress |
| SQLite storage | $88 | $40 | |
| SQL rows r/w | included | $80 | |
| KV I/O | included | $160 | |
| R2 archival | $3 | $3 | |
| **Total** | **$2,514** | **$62** | **97% savings** |

---

## 2. Monthly P&L (100k Users)

| Category | USD | Margin |
|:---------|:----|:-------|
| Gross revenue | $634,730 | 100% |
| DB sync (DO) | $295 | 0.05% |
| Hosting | $50 | 0.01% |
| AI LLM queries | $11,976 | 1.89% |
| **Total expenses** | **$12,321** | **1.94%** |
| **Net profit** | **$622,409** | **98.06%** |

---

## 3. AI Capacity (₹10L/mo pooled)

| Model | Cost/query | Monthly Capacity |
|:------|:-----------|:-----------------|
| DeepSeek-V3 | $0.000196 | ~61M queries |
| Gemini 2.0 Flash | $0.000180 | ~66.5M queries |

100k users → 610-660 queries/user/mo (~20/day).

---

## 4. Shopify-Scale Stress Test (250M orders/mo)

### Order Volume

| Input | Figure |
|:------|:-------|
| 2024 GMV | ~$292B |
| Avg order value | ~$100 |
| Orders/month | **~250M** |

### Per Order

| Metric | Count |
|:-------|:------|
| SQLite writes | ~8 |
| SQLite reads | ~15 |
| WS messages (20:1) | ~3 |
| R2 archive PUTs | batched |

### Monthly Cost

| Component | Cost |
|:----------|:-----|
| Workers base | $5 |
| Worker routing | $375 |
| DO requests (WS) | $112 |
| DO compute | $1,560 |
| SQLite rows r/w | $965 |
| KV I/O | $167 |
| R2 storage | $150 |
| R2 ops | $25 |
| **Total** | **~$3,360** |

**Cost per order: ~$0.0000134** (~$13 per million)

### Why It Stays Cheap

| Lever | Effect |
|:------|:-------|
| Order DOs self-delete | 250M DOs/mo → 0 standing |
| Zero egress | $0 bandwidth |
| Hibernation 20:1 | idle DOs ~free |
| R2 Parquet analytics | no always-on warehouse |

---

## 5. Three-Way Backend Comparison (~250M orders/mo)

| Backend | Monthly | Per Million Orders |
|:--------|:--------|:-------------------|
| **CF DO SQLite** | **~$3,509** | **~$14** |
| CF D1 | ~$3,921 | ~$16 |
| Turso | ~$37,869 | ~$152 |

**Egress dominates Turso** (95% of bill). DO SQLite wins on storage + zero egress.

---

## 6. Architecture Improvements (v2)

| Improvement | Impact |
|:------------|:-------|
| Namespace merge (11→4) | ~65% less routing logic |
| Geo cells → KV | ~$22/mo savings at 10k drivers |
| Motion sharding | ~40% less CPU (no vacuum) |
| Lazy schema init | ~20% less SQLite overhead |
