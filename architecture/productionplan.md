# Production Plan — Tar Commerce AI

**Ship in 2 days · Start: 23 Feb 2026**

---

## What We Have

| Resource                             | Status |
| :----------------------------------- | :----- |
| Fly.io + $15 machine                 | ✅     |
| Turso account                        | ✅     |
| CF Workers account                   | ✅     |
| Groq API key                         | ✅     |
| Expo RN app (local-first, 6 screens) | ✅     |

---

## Architecture

| What              | Who                                     |
| :---------------- | :-------------------------------------- |
| All CRUD          | App → local SQLite → Turso sync         |
| Telegram commands | CF Worker → Groq → tenant DB            |
| Identity          | Telegram login (default)                |
| Cloud upgrade     | CF Worker → sqld namespace + scoped JWT |
| Search            | CF Worker → Turso discovery             |
| Alarms            | CF Worker → Durable Objects             |
| Archive           | CF Worker → Railway S3                  |

### CF Worker — 3 Routes

```
POST /webhook/telegram       — bot webhook
GET  /api/search             — Turso discovery
POST /api/streams/archive    — stream → S3
```

### User Flow

```
Install → Telegram Login → Free (local + bot)
         ↓ /upgrade + ₹500
CF Worker creates sqld namespace + JWT → app syncs
```

---

## Day 1 — Build Everything

### sqld on Fly.io (2 hrs)

- [ ] Deploy `sqld` with persistent volume + JWT signing key
- [ ] Multi-tenant namespaces, schema: `nodes`, `points`, `events`
- [ ] Verify: scoped JWT isolates namespaces
- [ ] Verify: Turso RN SDK connects + syncs

### Groq AI (30 min)

- [ ] App: `openai/gpt-oss-120b` via Groq API
- [ ] CF Worker: `llama-3.1-8b-instant` via Groq API (14.4K/day free)
- [ ] `wrangler secret put GROQ_API_KEY`

### CF Worker + Telegram Bot (4 hrs)

- [ ] `wrangler init tar-api && wrangler deploy`
- [ ] Create bot @BotFather, set webhook
- [ ] `/start` → register user
- [ ] `/upgrade` → Razorpay link → on payment: create namespace + JWT → deep link
- [ ] Text messages → Groq parse → write tenant DB → reply
- [ ] `GET /api/search` → Turso discovery
- [ ] `POST /api/streams/archive` → S3

### Telegram Login in App (2 hrs)

- [ ] First launch → "Login with Telegram"
- [ ] Bot deep link → `/start app_login` → callback
- [ ] Store `telegramId` in SecureStore
- [ ] Free plan: local SQLite + bot access

### Cloud Sync in App (2 hrs)

- [ ] Settings → "Upgrade to Cloud"
- [ ] `/upgrade` → pay ₹500 → namespace + JWT → deep link back
- [ ] `db.ts`: `connect({ database: 'file:tar.db', syncUrl, authToken })`
- [ ] Local data auto-syncs on first connect

### Streams & Collaboration (3 hrs)

- [ ] Stream = shared sqld namespace
- [ ] Order → stream → participants get scoped JWT
- [ ] Events append, Telegram notifications
- [ ] Lifecycle: create → assign → pickup → deliver → archive

### Driver + GPS (2 hrs)

- [ ] Register via Telegram → own namespace
- [ ] GPS → local `points` → sync to sqld
- [ ] New order → nearest driver → assign → notify

### Turso Discovery (1 hr)

- [ ] `turso db create tar-discovery`
- [ ] Product publish → Turso, search endpoint

### Durable Objects (2 hrs)

- [ ] `OrderTimer`: 30 min → nudge if unpaid
- [ ] `MerchantCron`: daily reports
- [ ] Wire bindings in `wrangler.toml`

### Railway S3 Archive (1 hr)

- [ ] Create bucket, wire in CF Worker
- [ ] Stream complete → archive JSON → delete from sqld

### Razorpay Payment (2 hrs)

- [ ] `/upgrade` → Razorpay payment link (₹500/month)
- [ ] Payment webhook → provision namespace + JWT
- [ ] Test: pay → sync starts

### App Polish (3 hrs)

- [ ] Login: "Login with Telegram"
- [ ] Home: sync status (Free / Cloud)
- [ ] Settings: plan, sync toggle
- [ ] Streams tab: live order feed
- [ ] Icons, splash

### Day 1 Deliverable

```
✅ sqld on Fly.io (multi-tenant, JWT isolated)
✅ CF Worker (3 routes) + Telegram bot
✅ Telegram login + Cloud upgrade + sync
✅ Streams + drivers + GPS + discovery
✅ DO alarms + cron
✅ S3 archive
✅ Razorpay ₹500 subscription
✅ App polished
```

---

## Day 2 — Test & Ship

### E2E Full Flow (3 hrs)

```
1. Install → Telegram login → Free
2. Create products locally
3. /upgrade → pay ₹500 → namespace + JWT
4. Sync starts → data uploads
5. Telegram: "add 20 biryani at ₹250" → Groq → DB → reply
6. App syncs → visible
7. Order → driver assigned → delivered → archived to S3
8. Alarm fires → nudge
```

### Bug Fixes (3 hrs)

- [ ] Fix anything broken from E2E test
- [ ] Edge cases: offline → online, sync conflicts
- [ ] Error handling: payment fails, Groq down, sqld offline

### Build & Deploy (2 hrs)

- [ ] EAS Build Android APK
- [ ] Test on physical device
- [ ] Final CF Worker deploy with prod env vars
- [ ] Custom domain

### Documentation (2 hrs)

- [ ] README update
- [ ] Bot commands help text
- [ ] App store listing copy

### Day 2 Deliverable

```
✅ E2E tested
✅ Bugs fixed
✅ APK built
✅ Production live
```

---

## Summary

| Day   | Hrs | Ships                                                         |
| :---- | --: | :------------------------------------------------------------ |
| **1** | ~24 | Build everything: backend + app + streams + payments + polish |
| **2** | ~10 | Test + fix + build APK + deploy                               |

---

## Out of Scope

| Feature         | When              |
| :-------------- | :---------------- |
| WhatsApp        | Next sprint       |
| OVH VPS         | 50K+ users        |
| Self-hosted LFM | Outgrow Groq free |

---

## Accounts

| Service    | Have? |
| :--------- | :---- |
| Fly.io     | ✅    |
| Turso      | ✅    |
| CF Workers | ✅    |
| Groq       | ✅    |
| @BotFather | ⬜    |
| Railway    | ⬜    |
| Razorpay   | ⬜    |
| EAS        | ⬜    |

---

_Cost → [cost.md](./cost.md) · Pricing → [pricing.md](./pricing.md)_
