# Workers Secrets Checklist

Set secrets before first use. Run from each worker directory inside `cfworkers/`.

## tar-sync

```bash
cd cfworkers/tar-sync
wrangler secret put JWT_SECRET          # JWT signing key (generate: openssl rand -hex 32)
wrangler secret put GOOGLE_CLIENT_ID    # Google OAuth client ID
```

## s3storage

```bash
cd cfworkers/s3-storage
wrangler secret put AWS_ACCESS_KEY_ID        # S3 access key
wrangler secret put AWS_SECRET_ACCESS_KEY    # S3 secret key
wrangler secret put RAILWAY_STORAGE_ENDPOINT # e.g. https://t3.storageapi.dev
wrangler secret put RAILWAY_STORAGE_BUCKET_NAME # e.g. durable-wardrobe-8osafzz8
```

## turso-db

```bash
cd cfworkers/turso-db
wrangler secret put TURSO_URL                # libsql://global-tarframework...
wrangler secret put TURSO_AUTH_TOKEN         # Turso auth token (read/write)
wrangler secret put TURSO_PLATFORM_API_TOKEN # Turso Platform API token (for DB creation)
```

## tar-storefront

```bash
cd cfworkers/storefront
wrangler secret put TURSO_URL          # libsql://global-tarframework...
wrangler secret put TURSO_AUTH_TOKEN   # Turso auth token (read-only is fine)
```

## Deployed URLs

| Worker | URL |
|---|---|
| tar-sync | https://tar-sync.tar-54d.workers.dev |
| s3storage | https://s3storage.tar-54d.workers.dev |
| turso-db | https://turso-db.tar-54d.workers.dev |
| tar-storefront | https://tar-storefront.tar-54d.workers.dev |

## Deploy

```bash
./deploy.sh              # all
./deploy.sh tar-sync     # one
```
