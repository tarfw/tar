Now I have exact pricing from all sources. Here are the verified numbers:

## Verified pricing from official docs

**D1** (from developers.cloudflare.com/d1/platform/pricing):
```
Rows read:    $0.001 / million
Rows written: $1.00 / million
Storage:      $0.75 / GB-month
```

**Turso Scaler** (from turso.tech/pricing):
```
Row reads:  $0.80 / Billion
Row writes: $0.80 / Million
Storage:    $0.50 / GB
Sync:       $0.25 / GB (over 24GB included)
```

**Firestore Standard** (from cloud.google.com/firestore/pricing):
```
Document reads:  $0.03 / 100,000
Document writes: $0.09 / 100,000
Storage:         ~$0.18 / GiB-month
Egress:          $0.12 / GiB (over 10GiB free)
```

**DO SQLite** (from your screenshot):
```
Requests:        $0.15 / million
Duration:        $12.50 / million GB-s
SQL Rows Read:   $0.001 / million
SQL Rows Written: $1.00 / million
Storage:         $0.20 / GB-month
```

## Previous errors found

| What | Old (wrong) | Correct |
|---|---|---|
| Firestore reads | $0.06/100K | **$0.03/100K** |
| Firestore writes | $0.18/100K | **$0.09/100K** |

Firestore is **half** what I had before.

## Exact calculation

**Monthly totals:**
```
Reads:  1M users x 10,000/day x 30 days = 300,000,000,000 (300 billion)
Writes: 1M users x 1,000/day x 30 days  = 30,000,000,000 (30 billion)
```

**D1:**
```
Reads:  300,000,000,000 / 1,000,000 = 300,000 units
        300,000 x $0.001 = $300

Writes: 30,000,000,000 / 1,000,000 = 30,000 units
        30,000 x $1.00 = $30,000

Storage: 100 x $0.75 = $75

TOTAL: $30,375
```

**Turso Scaler:**
```
Reads:  300,000,000,000 / 1,000,000,000 = 300 units
        300 x $0.80 = $240

Writes: 30,000,000,000 / 1,000,000 = 30,000 units
        30,000 x $0.80 = $24,000

Storage: 100 x $0.50 = $50

Sync:  30M writes/day x 750 bytes = 22.5GB/day push
       200K actives x 10 pulls x 2KB = 4GB/day pull
       26.5GB/day x 30 = 795GB/month
       (795 - 24) = 771GB x $0.25 = $193

TOTAL: $24,483
```

**Firestore:**
```
Reads:  300,000,000,000 / 100,000 = 3,000,000 units
        3,000,000 x $0.03 = $90,000

Writes: 30,000,000,000 / 100,000 = 300,000 units
        300,000 x $0.09 = $27,000

Storage: 100 x $0.18 = $18

Egress: ~105GB x $0.12 = $13

TOTAL: $117,031
```

Wait — Firestore reads are now $90,000? Let me recheck.

```
300 billion reads / 100,000 = 3,000,000 units
3,000,000 x $0.03 = $90,000
```

Yes. At 300 billion reads, Firestore is actually the most expensive now.

**DO SQLite:**
```
Requests: 3.3B / 1M = 3,300 units
          3,300 x $0.15 = $495

Duration: 10,000 DOs x 128MB x 86,400s x 30d
          = 3,317,760,000 GB-s
          / 1M = 3,318 units
          3,318 x $12.50 = $41,475

SQL Reads:  300B / 1M = 300,000 units
            300,000 x $0.001 = $300

SQL Writes: 30B / 1M = 30,000 units
            30,000 x $1.00 = $30,000

Storage: 100 x $0.20 = $20

TOTAL: $72,290
```

## Final verified table

| Component | D1 | Turso Sync | Firestore | DO SQLite |
|---|---|---|---|---|
| Storage | $75 | $50 | $18 | $20 |
| Reads (300B) | $300 | $240 | $90,000 | $300 |
| Writes (30B) | $30,000 | $24,000 | $27,000 | $30,000 |
| Sync/Egress | $0 | $193 | $13 | $0 |
| Requests | $0 | $0 | $0 | $495 |
| Duration | $0 | $0 | $0 | $41,475 |
| **TOTAL** | **$30,375** | **$24,483** | **$117,031** | **$72,290** |
| **Per user/month** | **$0.030** | **$0.024** | **$0.117** | **$0.072** |

## Ranking

| Rank | Service | Per user/month |
|---|---|---|
| 1 | **Turso Sync** | $0.024 |
| 2 | **D1** | $0.030 |
| 3 | **DO SQLite** | $0.072 |
| 4 | **Firestore** | $0.117 |

Firestore's $0.03/100K read rate sounds cheap but at 300 billion reads it becomes $90,000. D1's $0.001/million read rate is actually cheaper for reads ($300 vs $90,000). D1 loses on writes ($30,000 vs Turso's $24,000). Turso wins overall because its $0.80/million write rate undercuts D1's $1.00/million.Now I have exact pricing from all sources. Here are the verified numbers:

## Verified pricing from official docs

**D1** (from developers.cloudflare.com/d1/platform/pricing):
```
Rows read:    $0.001 / million
Rows written: $1.00 / million
Storage:      $0.75 / GB-month
```

**Turso Scaler** (from turso.tech/pricing):
```
Row reads:  $0.80 / Billion
Row writes: $0.80 / Million
Storage:    $0.50 / GB
Sync:       $0.25 / GB (over 24GB included)
```

**Firestore Standard** (from cloud.google.com/firestore/pricing):
```
Document reads:  $0.03 / 100,000
Document writes: $0.09 / 100,000
Storage:         ~$0.18 / GiB-month
Egress:          $0.12 / GiB (over 10GiB free)
```

**DO SQLite** (from your screenshot):
```
Requests:        $0.15 / million
Duration:        $12.50 / million GB-s
SQL Rows Read:   $0.001 / million
SQL Rows Written: $1.00 / million
Storage:         $0.20 / GB-month
```

## Previous errors found

| What | Old (wrong) | Correct |
|---|---|---|
| Firestore reads | $0.06/100K | **$0.03/100K** |
| Firestore writes | $0.18/100K | **$0.09/100K** |

Firestore is **half** what I had before.

## Exact calculation

**Monthly totals:**
```
Reads:  1M users x 10,000/day x 30 days = 300,000,000,000 (300 billion)
Writes: 1M users x 1,000/day x 30 days  = 30,000,000,000 (30 billion)
```

**D1:**
```
Reads:  300,000,000,000 / 1,000,000 = 300,000 units
        300,000 x $0.001 = $300

Writes: 30,000,000,000 / 1,000,000 = 30,000 units
        30,000 x $1.00 = $30,000

Storage: 100 x $0.75 = $75

TOTAL: $30,375
```

**Turso Scaler:**
```
Reads:  300,000,000,000 / 1,000,000,000 = 300 units
        300 x $0.80 = $240

Writes: 30,000,000,000 / 1,000,000 = 30,000 units
        30,000 x $0.80 = $24,000

Storage: 100 x $0.50 = $50

Sync:  30M writes/day x 750 bytes = 22.5GB/day push
       200K actives x 10 pulls x 2KB = 4GB/day pull
       26.5GB/day x 30 = 795GB/month
       (795 - 24) = 771GB x $0.25 = $193

TOTAL: $24,483
```

**Firestore:**
```
Reads:  300,000,000,000 / 100,000 = 3,000,000 units
        3,000,000 x $0.03 = $90,000

Writes: 30,000,000,000 / 100,000 = 300,000 units
        300,000 x $0.09 = $27,000

Storage: 100 x $0.18 = $18

Egress: ~105GB x $0.12 = $13

TOTAL: $117,031
```

Wait — Firestore reads are now $90,000? Let me recheck.

```
300 billion reads / 100,000 = 3,000,000 units
3,000,000 x $0.03 = $90,000
```

Yes. At 300 billion reads, Firestore is actually the most expensive now.

**DO SQLite:**
```
Requests: 3.3B / 1M = 3,300 units
          3,300 x $0.15 = $495

Duration: 10,000 DOs x 128MB x 86,400s x 30d
          = 3,317,760,000 GB-s
          / 1M = 3,318 units
          3,318 x $12.50 = $41,475

SQL Reads:  300B / 1M = 300,000 units
            300,000 x $0.001 = $300

SQL Writes: 30B / 1M = 30,000 units
            30,000 x $1.00 = $30,000

Storage: 100 x $0.20 = $20

TOTAL: $72,290
```

## Final verified table

| Component | D1 | Turso Sync | Firestore | DO SQLite |
|---|---|---|---|---|
| Storage | $75 | $50 | $18 | $20 |
| Reads (300B) | $300 | $240 | $90,000 | $300 |
| Writes (30B) | $30,000 | $24,000 | $27,000 | $30,000 |
| Sync/Egress | $0 | $193 | $13 | $0 |
| Requests | $0 | $0 | $0 | $495 |
| Duration | $0 | $0 | $0 | $41,475 |
| **TOTAL** | **$30,375** | **$24,483** | **$117,031** | **$72,290** |
| **Per user/month** | **$0.030** | **$0.024** | **$0.117** | **$0.072** |

## Ranking

| Rank | Service | Per user/month |
|---|---|---|
| 1 | **Turso Sync** | $0.024 |
| 2 | **D1** | $0.030 |
| 3 | **DO SQLite** | $0.072 |
| 4 | **Firestore** | $0.117 |

Firestore's $0.03/100K read rate sounds cheap but at 300 billion reads it becomes $90,000. D1's $0.001/million read rate is actually cheaper for reads ($300 vs $90,000). D1 loses on writes ($30,000 vs Turso's $24,000). Turso wins overall because its $0.80/million write rate undercuts D1's $1.00/million.
