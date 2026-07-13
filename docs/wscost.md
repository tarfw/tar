# TAR Workspace Flow — Complete Cost Analysis

> All costs for workspace creation, ongoing operations, and infrastructure. Every number traced to source.

---

## 1. LLM Pricing (Z.AI GLM-4.7-Flash)

| Tier | Input | Output |
|------|-------|--------|
| Free tier | $0 | $0 |
| Paid tier | $0.14 / 1M tokens | $0.14 / 1M tokens |

> Model: Z.AI GLM-4.7-Flash. Thinking enabled. Temperature 0.2 for structured output.

---

## 2. Workspace Creation — LLM Calls

### The Flow (7 calls total)

| # | Step | Input Tokens | Output Tokens | Total | Why |
|---|------|-------------|---------------|-------|-----|
| 1 | Business extraction | 500 | 400 | 900 | Parse user message into structured data |
| 2 | Module selection | 300 | 50 | 350 | Pick 4-6 modules from 14 |
| 3 | Skill generation (×6) | 4,800 | 12,000 | 16,800 | SKILL.md per module with actions + steps |
| 4 | Site layout generation | 1,500 | 1,500 | 3,000 | Sections + CSS overrides + responsive |
| 5 | Brand/color suggestion | 200 | 100 | 300 | Suggests colors + fonts |
| 6 | Rule-critic (×2 passes) | 0 | 0 | 0 | Rule-based, no LLM |
| 7 | OKF content generation | 600 | 800 | 1,400 | profile.md, catalog.md, etc. |
| **Total** | | **7,900** | **14,850** | **22,750** | |

### Step-by-Step Detail

#### Step 1: Business Extraction

```
Input:
  System prompt                           ~200 tokens
  User message                            ~100 tokens
  Extraction JSON schema                  ~200 tokens
  Total input:                            ~500 tokens

Output:
  JSON: name, type, location, hours, products, services,
        policies, FAQs, brand_color, typography
  Total output:                           ~400 tokens
```

#### Step 2: Module Selection

```
Input:
  System prompt                           ~100 tokens
  14 module definitions                   ~150 tokens
  Extracted business data                 ~50 tokens
  Total input:                            ~300 tokens

Output:
  ["orders", "inventory", "bookings", "crm", "reports", "expenses"]
  Total output:                           ~50 tokens
```

#### Step 3: Skill Generation (per module)

```
Input:
  System prompt                           ~200 tokens
  Module definition                       ~200 tokens
  Business context                        ~100 tokens
  Turso schema (5 tables)                 ~300 tokens
  Total input per module:                 ~800 tokens

Output per module:
  Frontmatter (name, version, module, tools)
  Intent matching patterns
  Action definitions (3-5 actions per module)
  Each action: name, description, steps
  Config section (tax rates, categories, etc.)
  Total output per module:               ~2,000 tokens

Per module × 6 modules:
  Input:  800 × 6 = 4,800 tokens
  Output: 2,000 × 6 = 12,000 tokens
```

#### Step 4: Site Layout Generation

```
Input:
  System prompt                           ~300 tokens
  SECTIONS.json (section types)           ~500 tokens
  DESIGN-UNIVERSAL.md (base rules)        ~300 tokens
  ANTI-SLOP.json (anti-slop rules)        ~200 tokens
  Workspace data (products, policies)     ~200 tokens
  brand.md (colors, fonts)                ~100 tokens
  Reference site (if provided)            ~200 tokens
  Total input:                            ~1,500 tokens

Output:
  SiteLayout JSON:
    6-8 sections with type + layout variant
    CSS overrides per section
    Responsive breakpoints (mobile/tablet)
    Nested children for content_grid
  Total output:                           ~1,500 tokens
```

#### Step 5: Brand/Color Suggestion

```
Input:
  System prompt                           ~100 tokens
  Business type + description             ~100 tokens
  Total input:                            ~200 tokens

Output:
  { "primary": "#C0392B", "secondary": "#1C1C1C",
    "accent": "#D4A574",
    "heading_font": "Playfair Display",
    "body_font": "Inter" }
  Total output:                           ~100 tokens
```

#### Step 6: Rule-Critic (No LLM)

```
Input:  SiteLayout JSON (from step 4)
Process: Rule-based checks against ANTI-SLOP.json
  - emoji in headings:           regex check
  - >2 CTA per section:          count
  - placeholder text:            string match
  - gradient count:              count gradient properties
  - shadow depth:                check box-shadow values
  - symmetry:                    check grid balance
  - zIndex > 100:               clamp
  - position: fixed:            reject
Output: pass/fail + list of issues
Cost:   $0 (pure rule-based, no LLM)
```

#### Step 7: OKF Content Generation

```
Input:
  System prompt                           ~150 tokens
  Extracted business data                 ~200 tokens
  OKF format examples (profile, catalog)  ~250 tokens
  Total input:                            ~600 tokens

Output:
  - business/profile.md
  - products/catalog.md
  - policies/return.md
  - policies/delivery.md
  - faqs/common.md
  Total output:                           ~800 tokens
```

---

## 3. Workspace Creation — Infrastructure Cost

### Per Workspace Created

| Item | Storage | Cost |
|------|---------|------|
| Turso DB (`ws-{subdomain}`) | Schema DDL + extracted data | $0 (free tier: 500 DBs) |
| S3 writes (~20 files) | OKF bundle + site files | $0 (Railway free tier) |
| S2 streams (2-3 streams) | Event streams | $0 (free tier) |
| D1 row (1 row) | Workspace registry | $0 (free tier: 5GB) |
| KV cache (site cache) | Layout JSON | $0 (free tier: 100K reads) |
| **Total infra per workspace** | | **$0** |

### Infrastructure Free Tier Limits

| Service | Free Tier | Capacity |
|---------|-----------|----------|
| Turso | 500 databases, 9GB storage | 500 workspaces |
| Railway S3 | 1GB storage, unlimited writes | ~50 workspaces (20 files × ~5KB each) |
| S2.dev | 1M events/month | ~10K workspaces |
| D1 | 5GB storage, 5M reads/day | 25M workspace rows |
| KV | 100K reads/day, 1K writes/day | 100K site visits/day |
| Cloudflare Worker | 100K requests/day | 100K site requests/day |

---

## 4. Workspace Creation — Total Cost

| Component | Tokens | Rate | Cost |
|-----------|--------|------|------|
| LLM input | 7,900 | $0.14/1M | $0.0011 |
| LLM output | 14,850 | $0.14/1M | $0.0021 |
| **LLM total** | **22,750** | | **$0.0032** |
| Infrastructure | — | — | $0 |
| **Total per workspace** | | | **$0.0032** |

> ₹0.27 per workspace creation (at ₹83/USD)

---

## 5. Ongoing Operations — Monthly Cost Per User

### Chat Messages (LLM)

| Operation | Frequency | Input Tokens | Output Tokens | Cost |
|-----------|-----------|-------------|---------------|------|
| Daily chat (10 msgs/day) | 300/month | ~200 each | ~150 each | $0.0013 |
| Action execution | 100/month | 0 | 0 | $0 |
| Report generation | 5/month | ~400 | ~600 | $0.0001 |
| Skill customization | 2/month | ~500 | ~1,000 | $0.0002 |
| **Monthly LLM total** | | | | **~$0.0016** |

### Infrastructure (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Turso DB (workspace DB) | Reads + writes | $0 (free tier) |
| S3 (skill files, site) | Reads | $0 (Railway free tier) |
| S2 (event streams) | 1K events/day | $0 (free tier) |
| D1 (registry) | ~100 reads/day | $0 (free tier) |
| KV (site cache) | ~1K reads/day | $0 (free tier) |
| Worker (site rendering) | ~100 requests/day | $0 (free tier) |
| **Monthly infra total** | | **$0** |

### Total Monthly Cost Per User

| Component | Cost |
|-----------|------|
| LLM (chat + actions + customization) | ~$0.0016 |
| Infrastructure | $0 |
| **Total per user/month** | **~$0.0016** |

> ₹0.13/month per user

---

## 6. Revenue Model

| Item | Amount |
|------|--------|
| End-user price | ₹500/month |
| Target profit | ₹400/month |
| Max cost per user | ~₹100/month |
| LLM budget | ₹40 per million IO tokens |

### Actual Cost vs Budget

| Component | Actual | Budget | Margin |
|-----------|--------|--------|--------|
| Workspace creation (one-time) | ₹0.27 | — | — |
| Monthly LLM | ₹0.13 | ₹40 | 99.7% |
| Monthly infra | ₹0 | ₹60 | 100% |
| **Monthly total** | **₹0.13** | **₹100** | **99.87%** |

---

## 7. Cost at Scale

### Workspace Creation

| Workspaces | LLM Cost | Infra Cost | Total |
|------------|----------|------------|-------|
| 100 | $0.32 | $0 | $0.32 |
| 1,000 | $3.20 | $0 | $3.20 |
| 10,000 | $32.00 | ~$5 (Turso paid) | $37.00 |
| 100,000 | $320.00 | ~$50 | $370.00 |

### Monthly Operations (per 1,000 active users)

| Component | Cost |
|-----------|------|
| LLM (chat + actions) | $1.60 |
| Infrastructure | $0 |
| **Total monthly** | **$1.60** |

> ₹133/month for 1,000 users

---

## 8. Cost Comparison

### vs ChatGPT Plus ($20/month)

| | ChatGPT Plus | TAR Workspace |
|---|-------------|---------------|
| Monthly cost | $20 | $0.0016 |
| Workspace creation | N/A | $0.0032 |
| Action execution | N/A | $0 (no LLM) |
| Site hosting | N/A | $0 (CF free tier) |
| **12-month total** | **$240** | **$0.02** |

### vs Traditional SaaS (₹2,000/month)

| | Traditional SaaS | TAR Workspace |
|---|------------------|---------------|
| Monthly cost | ₹2,000 | ₹0.13 |
| Setup cost | ₹5,000-50,000 | ₹0.27 (one-time) |
| Customization | Developer hours | AI (free) |
| **12-month total** | **₹29,000-65,000** | **₹1.83** |

---

## 9. Optimization Opportunities

### Reduce LLM Calls

| Optimization | Current | Optimized | Savings |
|-------------|---------|-----------|---------|
| Batch skill generation (1 call for all 6) | 6 calls | 1 call | ~40% on step 3 |
| Combine extraction + module selection | 2 calls | 1 call | ~10% on steps 1-2 |
| Combine brand + site layout | 2 calls | 1 call | ~15% on steps 4-5 |
| **Total optimized** | **7 calls** | **3 calls** | **~50%** |

### Optimized Cost

| | Current | Optimized |
|---|---------|-----------|
| LLM tokens | 22,750 | ~11,000 |
| LLM cost | $0.0032 | $0.0015 |
| Savings | — | 53% |

### Cache Templates Per Vertical

| Optimization | Savings | Tradeoff |
|-------------|---------|----------|
| Cache SKILL.md templates per vertical (restaurant, salon, etc.) | ~60% on step 3 | Less personalized |
| Cache site layouts per vertical | ~50% on step 4 | Less unique |
| Pre-generate brand.md per vertical | ~100% on step 5 | User must override |

### Best Optimization: Batch Everything

```typescript
// Current: 7 separate LLM calls
const extraction = await llm(extractionPrompt);
const modules = await llm(modulePrompt);
const skills = await Promise.all(modules.map(m => llm(skillPrompt)));
const layout = await llm(layoutPrompt);
const brand = await llm(brandPrompt);
const okf = await llm(okfPrompt);

// Optimized: 3 LLM calls
const extraction = await llm(extractionPrompt);           // Step 1: Extract + pick modules
const skillsAndLayout = await llm(combinedPrompt);         // Step 2: Skills + layout + brand
const okf = await llm(okfPrompt);                         // Step 3: OKF content
```

---

## 10. Cost Drivers

### What Makes It Cheap

| Factor | Why |
|--------|-----|
| Z.AI GLM-4.7-Flash | Free tier available, $0.14/1M when paid |
| No LLM for actions | Actions are JSON step sequences, executed deterministically |
| No LLM for site visits | Static HTML/CSS from S3, cached in KV |
| No LLM for event processing | S2 streams → S3 Parquet, no inference |
| Rule-based anti-slop | No LLM call, just regex + counting |
| Draft pattern | Edits in local SQLite, sync to Turso on save |

### What Would Make It Expensive

| Risk | Impact | Mitigation |
|------|--------|------------|
| Using GPT-4 for extraction | 100× cost increase | Stick with Z.AI GLM-4.7-Flash |
| LLM for every action execution | 10× monthly cost | Cache actions as JSON steps |
| LLM for site rendering | 5× site cost | Static HTML from templates |
| No KV caching for sites | 10× Worker cost | KV cache with 5min TTL |
| No S2 for events | 2× Turso write cost | Bypass Turso for events |

---

## 11. Billing Model

### Per-User Subscription

| Tier | Price | Includes |
|------|-------|----------|
| Free | ₹0 | 1 workspace, 100 actions/month |
| Pro | ₹500/month | Unlimited workspaces, unlimited actions |
| Business | ₹1,500/month | Pro + custom domain + API access |

### Cost Allocation Per Tier

| Tier | LLM Cost | Infra Cost | Total Cost | Margin |
|------|----------|------------|------------|--------|
| Free | ₹0.27 (one-time) | ₹0 | ₹0.27 | -₹0.27 (acquisition) |
| Pro | ₹0.13/month | ₹0 | ₹0.13 | 99.97% |
| Business | ₹0.13/month | ~₹5 | ~₹5.13 | 99.66% |

---

## 12. Summary

| Metric | Value |
|--------|-------|
| LLM calls per workspace | 7 (optimizable to 3) |
| Tokens per workspace | 22,750 (optimizable to ~11,000) |
| Cost per workspace creation | $0.0032 (₹0.27) |
| Cost per user/month | $0.0016 (₹0.13) |
| Cost per 1,000 users/month | $1.60 (₹133) |
| Cost per 10,000 users/month | $16.00 (₹1,330) |
| Free tier capacity | 500 workspaces, 100K site visits/day |
| Break-even point | 1 paying user covers 3,846 users' LLM cost |
| Margin per user | 99.87% |
