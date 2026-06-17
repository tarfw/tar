# TAR Framework — Task Tracker

## Infrastructure

| # | Task | Status | Details |
|---|---|---|---|
| 1 | Worker reorganization | ✅ Complete | Moved 4 workers into `cfworkers/` with clean naming |
| 2 | tar-sync worker | ✅ Deployed | `https://tar-sync.tar-54d.workers.dev` — DO + WebSocket sync + auth |
| 3 | s3-storage worker | ✅ Deployed | `https://s3storage.tar-54d.workers.dev` — S3 presign only |
| 4 | turso-db worker | ✅ Deployed | `https://turso-db.tar-54d.workers.dev` — Turso publish, search, user DB, collab, archive |
| 5 | tar-storefront worker | ✅ Deployed | `market.tarai.space` — Marketplace HTML + JSON |
| 6 | Secrets — JWT_SECRET | ✅ Set | tar-sync |
| 7 | Secrets — GOOGLE_CLIENT_ID | ✅ Set | tar-sync |
| 8 | Secrets — AWS_ACCESS_KEY_ID | ✅ Set | s3-storage |
| 9 | Secrets — AWS_SECRET_ACCESS_KEY | ✅ Set | s3-storage |
| 10 | Secrets — RAILWAY_STORAGE_ENDPOINT | ✅ Set | s3-storage |
| 11 | Secrets — RAILWAY_STORAGE_BUCKET_NAME | ✅ Set | s3-storage |
| 12 | Secrets — TURSO_URL | ✅ Set | turso-db + storefront |
| 13 | Secrets — TURSO_AUTH_TOKEN | ✅ Set | turso-db + storefront |
| 14 | Secrets — TURSO_PLATFORM_API_TOKEN | ✅ Set | turso-db |
| 15 | Deploy script | ✅ Created | `deploy.sh` — deploy all or one worker |
| 16 | SECRETS.md | ✅ Created | Per-worker secret setup checklist |

## Durable Object & Sync

| # | Task | Status | Details |
|---|---|---|---|
| 17 | TarDO class | ✅ Complete | `cfworkers/tar-sync/src/tar-do.ts` — SQLite storage, LWW conflict resolution |
| 18 | WebSocket sync | ✅ Complete | client-init, client-sync, server-sync, broadcast, ack |
| 19 | User→WS mapping | ✅ Complete | DO tracks userId per WebSocket via tags, kick closes specific user |
| 20 | JWT auth | ✅ Complete | Google OAuth → JWT minting with scope claims |
| 21 | HTTP sync proxy | ✅ Complete | `/api/sync`, `/api/query`, `/api/kick` through Worker → DO |

## Client (tarapp)

| # | Task | Status | Details |
|---|---|---|---|
| 22 | Offline queue | ✅ Complete | Buffers changes to JSON file when disconnected, flushes on reconnect |
| 23 | Client URL updates | ✅ Complete | All lib files point to `tar-54d.workers.dev` URLs |
| 24 | Sync module cleanup | ✅ Complete | Removed duplicate code blocks in `lib/sync.ts` |

## Turso DB

| # | Task | Status | Details |
|---|---|---|---|
| 25 | Publish to Turso | ✅ Complete | matter + mass + relation inserts via Hrana pipeline |
| 26 | Vector search | ✅ Complete | Workers AI embedding + `vector_distance_cos` with LIKE fallback |
| 27 | User DB creation | ✅ Complete | Turso Platform API — create DB, generate auth token |
| 28 | Collab groups | ✅ Complete | Create/join group with dedicated Turso DB per group |
| 29 | R2 archive | ✅ Complete | `/api/archive` — read Turso scope → write JSON to R2 |
| 30 | R2 restore | ✅ Complete | `/api/restore` — read R2 archive → write back to Turso |
| 31 | Self-destruct | ✅ Complete | Archive then delete scope data from Turso |
| 32 | R2 bucket | ✅ Created | `tar-archive` bucket on Cloudflare R2 |
| 33 | Turso schema init | ✅ Complete | Tables created via direct API call |

## Storefront

| # | Task | Status | Details |
|---|---|---|---|
| 34 | Storefront routes | ✅ Deployed | `*.tarai.space/*` + `market.tarai.space/*` assigned to tar-storefront |
| 35 | Old storefront cleanup | ✅ Complete | Deleted old `storefront` worker, freed routes |

## Domain UIs

| # | Task | Status | Details |
|---|---|---|---|
| 36 | Marketing domain | ✅ Added | Push (601), SMS (602), Referral (603), Forms (604) — sample data + opcodes |
| 37 | Services domain | ✅ Added | Booked (701), Completed (702), Cancelled (703) — sample data + opcodes |
| 38 | Taxi domain | ✅ Added | Ride Req (903), Driver Match (904), In Ride (905), Trip End (906) — sample data + opcodes |
| 39 | OPCODE_LABELS | ✅ Updated | Added 602, 603, 703, 904, 906 labels |

## s3-storage Cleanup

| # | Task | Status | Details |
|---|---|---|---|
| 40 | Removed Turso logic | ✅ Complete | Removed `/api/publish`, `/api/global/search`, `/api/user/*`, `/api/collab/*` |
| 41 | Removed AI binding | ✅ Complete | No Workers AI on s3-storage |
| 42 | Removed test file | ✅ Complete | Deleted `test-upload.js` |
| 43 | Presign routes only | ✅ Complete | `/api/storage/presign-upload` + `/api/storage/presign-download` |

## tar-sync Cleanup

| # | Task | Status | Details |
|---|---|---|---|
| 44 | Removed publish/search | ✅ Complete | Routes moved to turso-db |
| 45 | Removed Turso env vars | ✅ Complete | No TURSO_URL/TURSO_AUTH_TOKEN on tar-sync |

## Deployment Summary

| Worker | URL | Lines |
|---|---|---|
| tar-sync | `https://tar-sync.tar-54d.workers.dev` | 289 |
| s3storage | `https://s3storage.tar-54d.workers.dev` | 136 |
| turso-db | `https://turso-db.tar-54d.workers.dev` | ~400 |
| tar-storefront | `market.tarai.space` | 351 |
