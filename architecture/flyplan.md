# Fly.io Machine Plan — 6 Month Roadmap

**Target: 1,000 paying customers · ₹5,00,000 MRR**

---

## Your Credits

| Type              |   Remaining | Monthly Value  |
| :---------------- | ----------: | :------------- |
| Free Allowances   |      $13.53 | Renews monthly |
| Purchased Credits |     $121.88 | One-time pool  |
| **Total**         | **$135.41** |                |

### Free Tier (every month)

| Allowance                       | Value | What it covers                |
| :------------------------------ | ----: | :---------------------------- |
| 3× shared-cpu-1x 256mb machines | $6.00 | sqld runs FREE here           |
| 3 GB volume storage             | $0.50 | First 3 GB free               |
| 30 GB outbound (India)          | $3.60 | Data transfer to Indian users |
| 30 GB outbound (Asia Pacific)   | $1.20 | Data transfer to APAC         |
| 10 GB volume snapshots          | $0.83 | Backup snapshots              |

> **Key insight:** sqld on `shared-cpu-1x 256mb` is **completely free** — it's within the 3 free machines.

---

## 6-Month Scaling Plan

### Phase 1: Launch (Month 1-2) — 0 to 100 customers

| Resource  | Spec                   |               Cost |
| :-------- | :--------------------- | -----------------: |
| Machine   | `shared-cpu-1x` 256 MB | **$0** (free tier) |
| Volume    | 3 GB                   | **$0** (free tier) |
| Outbound  | < 30 GB                | **$0** (free tier) |
| **Total** |                        |          **$0/mo** |

Config:

- `--max-active-namespaces 100` (default, all fit in memory)
- 100 tenants × ~2 MB avg DB = ~200 MB storage
- Plenty of headroom

### Phase 2: Growth (Month 3-4) — 100 to 500 customers

| Resource  | Spec                   |          Cost |
| :-------- | :--------------------- | ------------: |
| Machine   | `shared-cpu-1x` 512 MB |     ~$3.50/mo |
| Volume    | 5 GB                   |      $0.30/mo |
| Outbound  | ~50 GB                 |     ~$0.50/mo |
| **Total** |                        | **~$4.30/mo** |

Changes:

- Upgrade RAM to 512 MB: `fly scale memory 512`
- Extend volume: `fly volumes extend <id> --size 5`
- `--max-active-namespaces 200` (most inactive, loaded on demand)

### Phase 3: Scale (Month 5-6) — 500 to 1,000 customers

| Resource  | Spec                 |          Cost |
| :-------- | :------------------- | ------------: |
| Machine   | `shared-cpu-2x` 1 GB |     ~$7.00/mo |
| Volume    | 10 GB                |      $1.05/mo |
| Outbound  | ~100 GB              |     ~$1.50/mo |
| **Total** |                      | **~$9.55/mo** |

Changes:

- Upgrade to 2 vCPU + 1 GB RAM: `fly scale vm shared-cpu-2x --memory 1024`
- Extend volume to 10 GB
- `--max-active-namespaces 500`
- 1,000 tenants × ~5 MB avg = ~5 GB storage (well within 10 GB)

---

## 6-Month Cost Summary

| Month | Customers | Machine             | Monthly Cost | Credits Used |
| :---- | --------: | :------------------ | -----------: | -----------: |
| 1     |      0-50 | shared-cpu-1x 256MB |           $0 |           $0 |
| 2     |    50-100 | shared-cpu-1x 256MB |           $0 |           $0 |
| 3     |   100-250 | shared-cpu-1x 512MB |        $4.30 |        $4.30 |
| 4     |   250-500 | shared-cpu-1x 512MB |        $4.30 |        $8.60 |
| 5     |   500-750 | shared-cpu-2x 1GB   |        $9.55 |       $18.15 |
| 6     |  750-1000 | shared-cpu-2x 1GB   |        $9.55 |       $27.70 |
|       |           | **Total 6 months**  |              |   **$27.70** |

> **$27.70 out of $135.41 credits.** You'll have **$107.71 remaining** after 6 months.

---

## Revenue vs Cost

| Month | Customers | MRR (₹500 each) | Fly.io Cost |    Profit |
| :---- | --------: | --------------: | ----------: | --------: |
| 1     |        25 |         ₹12,500 |     $0 (₹0) |   ₹12,500 |
| 2     |        75 |         ₹37,500 |     $0 (₹0) |   ₹37,500 |
| 3     |       200 |       ₹1,00,000 |   $4 (₹330) |   ₹99,670 |
| 4     |       400 |       ₹2,00,000 |   $4 (₹330) | ₹1,99,670 |
| 5     |       700 |       ₹3,50,000 |  $10 (₹830) | ₹3,49,170 |
| 6     |     1,000 |       ₹5,00,000 |  $10 (₹830) | ₹4,99,170 |

> **99.8% profit margin.** Fly.io cost is basically invisible.

---

## Deploy Command (Phase 1 — Start Free)

```bash
cd tar-sqld

# 1. Generate JWT keys
openssl genpkey -algorithm Ed25519 -out libsql.pem
openssl pkey -in libsql.pem -pubout -out libsql.pub

# 2. Create app (uses free machine)
fly launch --no-deploy --region maa

# 3. Create volume (3GB free)
fly volumes create sqld_data --size 3 --region maa

# 4. Deploy
fly deploy

# 5. Verify
curl https://tar-sqld.fly.dev/health
```

### Upgrade Commands (when needed)

```bash
# Phase 2: Upgrade to 512MB
fly scale memory 512
fly volumes extend <vol-id> --size 5

# Phase 3: Upgrade to 2x CPU + 1GB
fly scale vm shared-cpu-2x --memory 1024
fly volumes extend <vol-id> --size 10
```

---

_libsql setup → [libsql.md](./libsql.md) · Cost → [cost.md](./cost.md)_
