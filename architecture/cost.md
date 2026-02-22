# Complete Cost Analysis: Tar Commerce AI

**Target: Chennai Metro — 10 Million Population**

---

## 1. Scale Parameters

| Metric                                                                |           Value |
| :-------------------------------------------------------------------- | --------------: |
| Population                                                            |      10,000,000 |
| Active merchants (all commerce)                                       |         200,000 |
| Active riders/drivers                                                 |          20,000 |
| Tenant databases (merchants + drivers + key actors)                   |        ~220,000 |
| Streams per day (food + taxi + grocery + ecom + services)             |      ~1,000,000 |
| **Streams per month**                                                 | **~30,000,000** |
| Events per stream (avg)                                               |             ~10 |
| Total stream events/month                                             |    ~300,000,000 |
| GPS pings/month (20K drivers × 10hrs × 360/hr × 30 days)              |  ~2,160,000,000 |
| Telegram messages/month (order alerts + driver alerts + merchant ops) |     ~90,000,000 |
| LLM parse calls/month (AI-powered text-to-JSON for orders + commands) |     ~35,000,000 |
| Cloudflare Worker requests/month (API calls + webhooks + alarms)      |    ~500,000,000 |
| Durable Object alarm invocations/month (scheduled tasks + nudges)     |     ~60,000,000 |

---

## 2. Service-by-Service Cost Breakdown

### 2A. Turso Managed Cloud (Public Discovery DB)

Used **only** for public discovery — global search, nearest-driver, menu browsing. NOT for streams, GPS, or tenant data.

| Item                      | Detail                      |
| :------------------------ | :-------------------------- |
| **Plan**                  | Scaler — $29/month (₹2,400) |
| **Included rows read**    | 100 billion/month           |
| **Included rows written** | 100 million/month           |
| **Overage reads**         | $0.80 per billion rows      |
| **Overage writes**        | $0.80 per million rows      |

**Write Volume Estimation:**

| Turso Write Trigger                            |    Writes/month |
| :--------------------------------------------- | --------------: |
| Menu edits (200K merchants × 5/month)          |      ~1,000,000 |
| Driver shift on/off (20K × 2/day × 30)         |      ~1,200,000 |
| Driver assigned per order (1M/day × 30 days)   |     ~30,000,000 |
| Driver delivered / status change (1M/day × 30) |     ~30,000,000 |
| **Total Turso writes**                         | **~62,200,000** |

> ⚠️ 100M writes included in Scaler plan — we stay **within limits**.

**Read Volume Estimation:**

| Turso Read Trigger                                     |      Reads/month |
| :----------------------------------------------------- | ---------------: |
| Customer search queries (5M users × 10 searches/month) |      ~50,000,000 |
| Nearest-driver lookups (1M orders/day × 30)            |      ~30,000,000 |
| Menu browsing reads                                    |      ~20,000,000 |
| **Total Turso reads**                                  | **~100,000,000** |

> ✅ Well within 100 billion included reads. Negligible.

| Turso Component  |           Monthly Cost |
| :--------------- | ---------------------: |
| Scaler plan base |                 ₹2,400 |
| Write overages   | ₹0 (within 100M limit) |
| Read overages    | ₹0 (within 100B limit) |
| **Turso Total**  |             **₹2,400** |

---

### 2B. Self-Hosted LibSQL (OVH VPS)

All high-frequency, high-volume data lives here at **zero per-row cost**:

- 220K tenant namespace databases (nodes + points)
- Streams namespace (shared collaboration events)
- GPS pings (2.16 billion/month)
- All stream events (300 million/month)

| Item             | Detail                                  |
| :--------------- | :-------------------------------------- |
| **Provider**     | OVH VPS 6                               |
| **Specs**        | 24 vCores · 96 GB RAM · 400 GB NVMe SSD |
| **Cost**         | ~$45/month (₹3,800)                     |
| **Per-row cost** | ₹0.00 (self-hosted = flat VPS fee only) |

**Why self-hosted?** If these writes were on Turso Cloud:

| Data Type                 |  Writes/month |       Turso Cost |
| :------------------------ | ------------: | ---------------: |
| Stream events             |   300,000,000 |          ₹25,000 |
| GPS pings                 | 2,160,000,000 |        ₹1,80,000 |
| Tenant node/point updates |    50,000,000 |           ₹4,200 |
| **Total if on Turso**     |               |    **₹2,09,200** |
| **Your cost (OVH VPS)**   |               |       **₹3,800** |
| **Savings**               |               | **~55x cheaper** |

| LibSQL Component | Monthly Cost |
| :--------------- | -----------: |
| OVH VPS 6        |       ₹3,800 |
| **LibSQL Total** |   **₹3,800** |

---

### 2C. Cloudflare Workers (API Gateway + Orchestration)

All API requests route through CF Workers — webhooks, order routing, auth, stream reads/writes.

| Item                   | Detail                         |
| :--------------------- | :----------------------------- |
| **Plan**               | Workers Paid — $5/month (₹420) |
| **Included requests**  | 10,000,000/month               |
| **Overage**            | $0.30 per million requests     |
| **Our request volume** | ~500,000,000/month             |

| CF Workers Component | Calculation                   | Monthly Cost |
| :------------------- | :---------------------------- | -----------: |
| Base plan            | Flat                          |         ₹420 |
| Overage requests     | (500M - 10M) × $0.30/M = $147 |      ₹12,350 |
| **CF Workers Total** |                               |  **₹12,770** |

---

### 2D. Cloudflare Durable Objects + Alarms (Scheduled Tasks)

Used for time-delayed tasks: abandoned cart nudges, order timeout checks, scheduled cron-like jobs per merchant.

| Item                      | Detail                            |
| :------------------------ | :-------------------------------- |
| **Included DO requests**  | 1,000,000/month (in Workers Paid) |
| **Overage**               | $0.15 per million requests        |
| **Included compute**      | 400,000 GB-s/month                |
| **Compute overage**       | $12.50 per million GB-s           |
| **Our alarm invocations** | ~60,000,000/month                 |
| **Avg compute per alarm** | ~5ms × 128MB = ~0.00064 GB-s      |

| DO Component          | Calculation                                          | Monthly Cost |
| :-------------------- | :--------------------------------------------------- | -----------: |
| DO request overages   | (60M - 1M) × $0.15/M = $8.85                         |         ₹745 |
| DO compute            | 60M × 0.00064 GB-s = 38,400 GB-s (within 400K limit) |           ₹0 |
| **DO + Alarms Total** |                                                      |     **₹745** |

---

### 2E. Telegram Bot API (Omnichannel Interface)

The primary user-facing channel for merchants, drivers, and order alerts.

| Item                   | Detail                                              |
| :--------------------- | :-------------------------------------------------- |
| **API cost**           | **₹0 — completely free**                            |
| **Message limits**     | 30 msg/sec to different chats (no hard monthly cap) |
| **Group limits**       | 20 msg/min per group                                |
| **File uploads**       | Up to 50 MB (2 GB with local Bot API server)        |
| **Our message volume** | ~90,000,000/month                                   |

| Telegram Volume Breakdown                    |  Messages/month |
| :------------------------------------------- | --------------: |
| Order status alerts to customers             |     ~30,000,000 |
| Driver assignment + navigation notifications |     ~30,000,000 |
| Merchant operational commands & responses    |     ~20,000,000 |
| Kitchen/staff alerts & confirmations         |     ~10,000,000 |
| **Total Telegram messages**                  | **~90,000,000** |

> ✅ Telegram has no per-message fees. 90M messages/month at ₹0.
> At 30 msg/sec throughput, we can handle ~2.6M messages/day which covers our ~3M/day peak.
> For burst handling, multiple bot tokens can be load-balanced.

| Telegram Component | Monthly Cost |
| :----------------- | -----------: |
| Bot API usage      |           ₹0 |
| **Telegram Total** |       **₹0** |

---

### 2F. AI Parse Layer — Self-Hosted Liquid LFM 1.6B

Used for "Parse Once, Execute Directly" — converts natural language commands into structured JSON.

| Item                    | Detail                                                 |
| :---------------------- | :----------------------------------------------------- |
| **Model**               | Liquid Foundation Model (LFM) 2.5 VL — 1.6B parameters |
| **Hosting**             | Runs on the **same OVH VPS 6** alongside LibSQL        |
| **RAM usage**           | ~3-4 GB (1.6B model fits easily in 96 GB VPS)          |
| **Per-call cost**       | **₹0.00** — self-hosted, no API fees                   |
| **Our LLM calls/month** | ~35,000,000                                            |
| **Latency**             | ~20-50ms per call (CPU inference, small model)         |

> ✅ LFM 1.6B is purpose-built for structured extraction tasks (text → JSON).
> It runs on CPU — no GPU required. The OVH VPS 6 (24 vCores, 96 GB RAM) handles both
> LibSQL databases AND AI inference simultaneously.

| AI Component        |         Monthly Cost |
| :------------------ | -------------------: |
| LFM 1.6B on OVH VPS | ₹0 (included in VPS) |
| **AI Total**        |               **₹0** |

> 💡 **Why not Groq API?**
>
> - Groq would cost **₹33,810/month** for 35M calls at Chennai scale
> - Self-hosting eliminates the single largest cost item
> - LFM 1.6B is small enough for CPU — no GPU rental needed
> - Zero vendor dependency, zero rate limits, zero per-token fees

---

### 2G. Railway S3 (Cold Archive)

Completed streams archived as JSON, then deleted from active LibSQL.

| Item                        | Detail                         |
| :-------------------------- | :----------------------------- |
| **Storage cost**            | $0.015 per GB-month            |
| **Egress**                  | Free (unlimited)               |
| **API operations**          | Free (unlimited)               |
| **New archives/month**      | ~30,000,000 streams            |
| **Avg stream archive size** | ~2 KB (10 events × ~200 bytes) |
| **Monthly new data**        | ~60 GB                         |
| **Cumulative after 1 year** | ~720 GB                        |

| Railway Component                 | Calculation             | Monthly Cost |
| :-------------------------------- | :---------------------- | -----------: |
| Storage (avg ~360 GB over Year 1) | 360 GB × $0.015 = $5.40 |         ₹450 |
| **Railway S3 Total (Year 1 avg)** |                         |     **₹450** |

---

## 3. Total Monthly Cost — Chennai Scale

|  #  | Component                           | Service                       | What it handles                                                    | Monthly Cost |
| :-: | :---------------------------------- | :---------------------------- | :----------------------------------------------------------------- | -----------: |
|  1  | **Discovery DB**                    | Turso Scaler                  | Public search, nearest-driver, menu browsing                       |   **₹2,400** |
|  2  | **Tenant DBs + Streams + GPS + AI** | OVH VPS 6 (LibSQL + LFM 1.6B) | 220K namespaces, 2.16B GPS pings, 300M stream events, AI inference |   **₹3,800** |
|  3  | **API Gateway**                     | Cloudflare Workers            | 500M API requests, webhooks, routing, auth                         |  **₹12,770** |
|  4  | **Scheduled Tasks**                 | CF Durable Objects            | 60M alarms — cart nudges, cron jobs, timeouts                      |     **₹745** |
|  5  | **Chat Interface**                  | Telegram Bot API              | 90M messages — alerts, commands, notifications                     |       **₹0** |
|  6  | **AI Parse Layer**                  | Self-hosted LFM 1.6B          | 35M text-to-JSON calls — runs on same VPS                          |       **₹0** |
|  7  | **Cold Archive**                    | Railway S3                    | 60 GB/month stream archives                                        |     **₹450** |
|     |                                     |                               | **TOTAL**                                                          |  **₹20,165** |

---

## 4. Cost Per Transaction

```
₹20,165/month ÷ 30,000,000 streams/month = ₹0.00067 per order

That's roughly 1 paisa per 15 orders.
```

---

## 5. Per-User Monthly Cost by Usage Tier

### User Profiles

| Metric                     | 🟢 Light              | 🟡 Mid                          | 🔴 Heavy                                |
| :------------------------- | :-------------------- | :------------------------------ | :-------------------------------------- |
| **Who**                    | Small shop / vendor   | Mid restaurant / service        | High-volume restaurant                  |
| **Orders placed/received** | 1,000/month (~33/day) | 6,000/month (200/day)           | 10,000/month (~333/day)                 |
| **Telegram messages**      | 2,000/month           | 12,000/month                    | 20,000/month                            |
| **LLM parse calls**        | 1,000/month           | 6,000/month                     | 10,000/month                            |
| **API requests**           | 5,000/month           | 30,000/month (~5 per order)     | 50,000/month (~5 per order)             |
| **DO alarms triggered**    | 1,000/month           | 6,000/month (timeout per order) | 10,000/month (timeout per order)        |
| **GPS pings**              | 0                     | 0                               | 0                                       |
| **Turso discovery writes** | 2,000/month           | 12,000/month                    | 20,000/month (status changes per order) |

### Per-User Cost Breakdown

| Service                       | Unit Cost        |  🟢 Light |    🟡 Mid |  🔴 Heavy |
| :---------------------------- | :--------------- | --------: | --------: | --------: |
| **Turso** (discovery writes)  | ₹0.000067/write  |     ₹0.13 |     ₹0.80 |     ₹1.34 |
| **LibSQL** (flat VPS ÷ users) | ₹3,800 ÷ 220K    |     ₹0.02 |     ₹0.02 |     ₹0.02 |
| **CF Workers**                | ₹0.025/1K req    |     ₹0.13 |     ₹0.75 |     ₹1.25 |
| **CF DO Alarms**              | ₹0.013/1K alarms |     ₹0.01 |     ₹0.08 |     ₹0.13 |
| **Telegram**                  | ₹0               |     ₹0.00 |     ₹0.00 |     ₹0.00 |
| **LFM 1.6B** (on VPS)         | ₹0 (self-hosted) |     ₹0.00 |     ₹0.00 |     ₹0.00 |
| **Railway S3**                | ₹0.000015/stream |     ₹0.02 |     ₹0.09 |     ₹0.15 |
| **Total per user/month**      |                  | **₹0.31** | **₹1.74** | **₹2.89** |

> 💡 A high-volume restaurant doing 333 orders/day costs us **₹2.89/month** — charge them ₹999/month and you have **99.7% margin**.

### Population Mix & Weighted Average

| Tier                |   Merchants | Per-User Cost |    Tier Total |
| :------------------ | ----------: | ------------: | ------------: |
| 🟢 Light            |     150,000 |         ₹0.31 |       ₹46,500 |
| 🟡 Mid              |      45,000 |         ₹1.74 |       ₹78,300 |
| 🔴 Heavy            |       5,000 |         ₹2.89 |       ₹14,450 |
| **Total Merchants** | **200,000** |               | **₹1,39,250** |

> ⚠️ The weighted total (₹1.39L) is higher than actual infra (₹20K) because resources are pooled.
> With self-hosted LFM 1.6B, the AI cost line — previously the biggest expense — is now **₹0**.
>
> **Platform cost per merchant: ₹20,165 ÷ 200,000 = ₹0.10/merchant/month**

---

## 6. If Everything Was on Turso Cloud

| Item                     |          Turso Cost |
| :----------------------- | ------------------: |
| 300M stream event writes |             ₹25,000 |
| 2.16B GPS writes         |           ₹1,80,000 |
| 62M discovery writes     |              ₹5,200 |
| 50M tenant writes        |              ₹4,200 |
| Storage (500+ GB)        |             ₹10,000 |
| **Turso-only total**     | **₹2,24,400/month** |
| **Your architecture**    |   **₹20,165/month** |
| **Savings**              |    **~11x cheaper** |

> And Turso-only doesn't include CF Workers or S3 — those would still be needed on top.

---

## 7. Scaling Roadmap

### Phase 1: Launch (0 → 10K users) — ₹1,260/month

| Component        | Strategy                            |       Cost |
| :--------------- | :---------------------------------- | ---------: |
| Turso            | Free plan (10M writes, 500M reads)  |         ₹0 |
| LibSQL + LFM AI  | Fly.io $15 machine                  |     ₹1,260 |
| CF Workers       | Free tier (100K req/day = 3M/month) |         ₹0 |
| Durable Objects  | Within free tier                    |         ₹0 |
| Telegram         | Free                                |         ₹0 |
| Railway S3       | Free tier (10 GB)                   |         ₹0 |
| **Launch Total** |                                     | **₹1,260** |

### Phase 2: Growth (10K → 100K users) — ₹4,500/month

| Component        | Strategy                      |       Cost |
| :--------------- | :---------------------------- | ---------: |
| Turso            | Developer plan ($4.99/month)  |       ₹420 |
| LibSQL + LFM AI  | OVH VPS 3 ($12/month)         |     ₹1,000 |
| CF Workers       | Workers Paid + light overages |     ₹1,500 |
| Durable Objects  | Within paid plan limits       |       ₹420 |
| Telegram         | Free                          |         ₹0 |
| Railway S3       | ~20 GB                        |        ₹25 |
| **Growth Total** |                               | **₹3,365** |

### Phase 3: Chennai Scale (10M population) — ₹20,165/month

Full breakdown as in Section 3 above.

> 🎯 With self-hosted LFM 1.6B: **₹0.00067 per order** — 1 paisa per 15 orders.

---

## 8. Comparative Cost Analysis

### Tar vs Traditional SaaS Infrastructure

| Metric                 |           Traditional (AWS/GCP) |            Tar Architecture |
| :--------------------- | ------------------------------: | --------------------------: |
| 220K user databases    |       ₹5,00,000+ (RDS/DynamoDB) | ₹3,800 (self-hosted LibSQL) |
| 2.16B GPS writes/month |           ₹2,00,000+ (DynamoDB) |        ₹0 (included in VPS) |
| 500M API requests      | ₹50,000+ (API Gateway + Lambda) |        ₹12,770 (CF Workers) |
| 90M push notifications |              ₹15,000+ (FCM/SNS) |       ₹0 (Telegram Bot API) |
| AI/NLP processing      |         ₹1,00,000+ (managed AI) | ₹0 (self-hosted LFM on VPS) |
| **Monthly Total**      |                  **₹8,65,000+** |                 **₹20,165** |
| **Savings**            |                                 |            **~43x cheaper** |

---

## 9. Annual Projection

| Year    | Cumulative S3 Storage | Monthly Infra Cost | Annual Cost |
| :------ | --------------------: | -----------------: | ----------: |
| Year 1  |               ~720 GB |           ~₹20,165 |  ~₹2,42,000 |
| Year 2  |             ~1,440 GB |           ~₹20,165 |  ~₹2,42,000 |
| Year 3+ |             ~2,160 GB |           ~₹20,165 |  ~₹2,42,000 |

> 💰 **Total 3-year infrastructure cost: ~₹7,26,000 (~$8,600)**
> For a platform serving **10 million people** with **30 million transactions/month**.

---

## 10. Key Assumptions & Notes

1. **Exchange rate:** $1 = ₹84 (used throughout)
2. **Turso Scaler plan** is sufficient up to 100M writes/month — current estimates are ~62M
3. **Telegram Bot API** has no hard monthly limits, but rate limits of 30 msg/sec apply — multiple bot tokens can be load-balanced for burst handling
4. **LFM 1.6B** (Liquid Foundation Model) is self-hosted on the same OVH VPS — 1.6B params fits in ~3-4 GB RAM, runs on CPU, no GPU needed
5. **Not all requests need LLM** — only natural language Telegram/WhatsApp commands go through LFM; direct API calls bypass AI entirely
6. **GPS pings** stay on self-hosted LibSQL only — never touch Turso cloud
7. **Stream events** are ephemeral — active DB stays ~100 MB, everything archives to Railway S3
8. **OVH VPS** in Singapore region (closest to Chennai, ~60-80ms latency) — direct India datacenter not available
9. **CF Workers** are globally distributed — Chennai users hit nearest edge node for sub-50ms API latency
10. **VPS handles dual workload** — LibSQL (database) + LFM 1.6B (AI) both run on the same 24-core, 96 GB machine
