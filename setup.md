# Setup

Set secrets before first use. Run from `taragent/`.

## Required secrets

```bash
cd taragent

wrangler secret put ANTHROPIC_API_KEY     # Anthropic API key for LLM
wrangler secret put TURSO_DATABASE_URL    # libsql://global-tarapp...
wrangler secret put TURSO_AUTH_TOKEN      # Turso auth token (read/write)
wrangler secret put TURSO_PLATFORM_TOKEN  # Turso Platform API (for user DB creation)
wrangler secret put RAILWAY_S3_ENDPOINT   # e.g. https://t3.storageapi.dev
wrangler secret put RAILWAY_S3_BUCKET     # e.g. customizable-box-hw-fvnq8
wrangler secret put RAILWAY_S3_ACCESS_KEY # S3 access key
wrangler secret put RAILWAY_S3_SECRET_KEY # S3 secret key
```

## Local dev

Copy `.env.example` to `.env` and fill in values. The `.env` file is gitignored.

## Worker URL

| Worker | URL |
|---|---|
| taragent | https://taragent.tar-54d.workers.dev |
| storefront | https://{workspace}.tarai.space |
