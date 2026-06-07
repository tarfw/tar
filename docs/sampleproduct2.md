# Product Variants & Modifiers (v2)

## motion DDL

```sql
CREATE TABLE motion (
  stream TEXT NOT NULL,        -- mass.id or matter.id
  seq    INTEGER NOT NULL,     -- unixepoch_ms*1000 + nonce
  action INTEGER NOT NULL,     -- opcode
  phase  INTEGER,              -- in-place lifecycle pointer
  delta  REAL,
  data   TEXT,
  PRIMARY KEY (stream, seq)
) WITHOUT ROWID;
-- event time on read: datetime(seq / 1000000, 'unixepoch')
```

| Column | Note |
| :--- | :--- |
| `seq` | Unique offline, encodes event time — no `time` column |
| `action` | Opcode only; labels in `lib/opcodes.ts` |
| `phase` | Lifecycle updates in place — no new rows. Financial events append-only |
| no `id` | `(stream, seq)` is the identity |
| no `scope` | DB file is already scope-routed |

Enums: `mass.type` 1=stock 2=slot 3=cart 4=ticket 5=lead 6=trip 7=shift 8=form_task · `relation.type` 1=parent-child 2=blocked_by 3=assigned_to 4=submits_to 5=recipe-item

Epoch base: `2026-06-07T12:00:00Z` = `1780833600`.

---

## Example 1: Sneakers (Variants)

### matter — `global.db` only; option arrays stored once here

| id | code | type | scope | owner | title | public | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers` | `SNEAKERS01` | `product` | `g` | `sneakercompany` | `Everyday Sneakers` | `1` | `{"cat":"retail","p":"89.00","o":{"c":["Black","Red"],"s":["S","M"]}}` | `1780833600` |
| `store101` | `TAMILSHOES` | `profile` | `g` | `sneakercompany` | `Tamil Shoes Store` | `1` | `{"cat":"store","cur":"INR"}` | `1780833600` |

### mass — store sync DB (`s:101`)

| id | matter | type | scope | qty | value | active | variant | mark | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers0` | `sneakers` | `1` | `s:101` | `10` | `89.00` | `1` | `0` | `0` | `1780833600` |
| `sneakers1` | `sneakers` | `1` | `s:101` | `5` | `89.00` | `1` | `1` | `0` | `1780833600` |
| `sneakers2` | `sneakers` | `1` | `s:101` | `8` | `95.00` | `1` | `2` | `0` | `1780833600` |
| `sneakers3` | `sneakers` | `1` | `s:101` | `0` | `95.00` | `1` | `3` | `0` | `1780833600` |

| Column | Note |
| :--- | :--- |
| `variant` | `colorIdx * 2 + sizeIdx` → Black/S=0, Black/M=1, Red/S=2, Red/M=3 |
| `qty` | Snapshot — written only at day-close, never per sale |
| `mark` | Last seq folded into `qty`; older motion rows safe to delete |

Option value rules (array position = variant identity):

- Immutable: never reorder or remove values — append only; retire a variant by setting its mass row `active=0`.
- Volatile dimension first: only the major (leftmost) axis can grow; the minor axis length is the frozen multiplier.
- Define the minor axis completely up front — reserve every size you might ever stock at creation.
- Array order is the permanent display order — never sort; renaming a label in place is safe, moving it is not.

Live qty:
```sql
SELECT m.qty + COALESCE(SUM(mo.delta), 0)
FROM mass m LEFT JOIN motion mo ON mo.stream = m.id AND mo.seq > m.mark
WHERE m.id = 'sneakers0';
```

### relation — store sync DB

| src | tgt | type | weight | time |
| :--- | :--- | :--- | :--- | :--- |
| `s:101` | `sneakers` | `3` | `1.0` | `1780833600` |

### motion — store sync DB (v1: 15 rows → v2: 8)

| stream | seq | action | phase | delta | data |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers0` | `1780833900000001` | `101` | *NULL* | `-1.0` | *NULL* |
| `sneakers0` | `1780834800000001` | `105` | `109` | `1.0` | `{"co":"web","ph":{"109":1780835100},"carrier":"express"}` |
| `sneakers0` | `1780835400000001` | `110` | *NULL* | `89.00` | `{"tax":12.00}` |
| `sneakers0` | `1780835700000001` | `111` | *NULL* | `-1.0` | `{"r":"return"}` |
| `sneakers0` | `1780836000000001` | `201` | *NULL* | `89.00` | `{"pay":"cash"}` |
| `sneakers0` | `1780836300000001` | `405` | *NULL* | `-5.0` | `{"dest":"warehouse2"}` |
| `sneakers0` | `1780836600000001` | `406` | *NULL* | `10.0` | `{"src":"warehouse1"}` |
| `sneakers0` | `1780836900000001` | `801` | `802` | `89.00` | `{"m":"stripe","ref":"ref123","ph":{"802":1780836960}}` |

Row `105`: PLACED → DELIVERED via `phase=109`, step times in `ph`. Row `801`: PENDING → SUCCESS via `phase=802`.

### motion — local private `user_{self}.db` (never synced)

Cart events. Single writer → dense seq, `time` kept.

| stream | seq | action | delta | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sneakers0` | `1` | `102` | `1.0` | *NULL* | `1780834200` |
| `sneakers0` | `2` | `103` | `-1.0` | *NULL* | `1780834500` |
| `sneakers0` | `3` | `104` | `0.0` | `{"step":"billing"}` | `1780834560` |

---

## Example 2: Pizza (Modifiers)

### matter — `global.db` only

| id | code | type | scope | owner | title | public | data | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pizza` | `PIZZA01` | `product` | `g` | `pizzacompany` | `Pepperoni Pizza` | `1` | `{"cat":"food","p":"12.00","o":{"s":["Small","Medium","Large"]}}` | `1780833600` |
| `extracheese` | `MODCHEESE` | `product` | `g` | `pizzacompany` | `Extra Cheese` | `1` | `{"mod":1}` | `1780833600` |
| `pepperoni` | `MODPEPPERONI` | `product` | `g` | `pizzacompany` | `Extra Pepperoni` | `1` | `{"mod":1}` | `1780833600` |
| `store102` | `TAMILPIZZA` | `profile` | `g` | `pizzacompany` | `Tamil Pizza Shop` | `1` | `{"cat":"restaurant","cur":"INR"}` | `1780833600` |

### mass — store sync DB (`s:102`)

`variant` = size index. Modifiers untracked: `qty NULL`, no motion rows.

Option value rules: same as sneakers — append only, never reorder/remove; single dimension so it can always grow; array order is permanent display order.

| id | matter | type | scope | qty | value | active | variant | mark | time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pizza0` | `pizza` | `1` | `s:102` | `50` | `10.00` | `1` | `0` | `0` | `1780833600` |
| `pizza1` | `pizza` | `1` | `s:102` | `50` | `12.00` | `1` | `1` | `0` | `1780833600` |
| `pizza2` | `pizza` | `1` | `s:102` | `50` | `15.00` | `1` | `2` | `0` | `1780833600` |
| `pricecheese` | `extracheese` | `1` | `s:102` | *NULL* | `1.50` | `1` | *NULL* | `0` | `1780833600` |
| `pricepepperoni` | `pepperoni` | `1` | `s:102` | *NULL* | `2.00` | `1` | *NULL* | `0` | `1780833600` |

### relation — store sync DB

| src | tgt | type | weight | time |
| :--- | :--- | :--- | :--- | :--- |
| `pizza` | `extracheese` | `1` | `1.0` | `1780833600` |
| `pizza` | `pepperoni` | `1` | `1.0` | `1780833600` |
| `s:102` | `pizza` | `3` | `1.0` | `1780833600` |

### motion — store sync DB (v1: 13 rows → v2: 4)

8-row KDS choreography = one PLACED row, `phase` advanced in place, timeline in `ph`:

| stream | seq | action | phase | delta | data |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pizza0` | `1780833900000002` | `101` | *NULL* | `-1.0` | *NULL* |
| `pizza0` | `1780834200000002` | `105` | `109` | `1.0` | `{"ph":{"106":1780834320,"107":1780834500,"206":1780834560,"207":1780834800,"108":1780834920,"109":1780835100},"staff":"mgr01","kds":"kds1"}` |
| `pizza0` | `1780835400000002` | `201` | *NULL* | `10.00` | `{"till":"till1"}` |
| `pizza0` | `1780835460000002` | `801` | `802` | `10.00` | `{"m":"card","ref":"tx992","ph":{"802":1780835520}}` |

KDS transition: `UPDATE motion SET phase = :op, data = json_set(data, '$.ph.' || :op, unixepoch()) WHERE stream=? AND seq=?;`

---

## Day-Close Compaction

Once a day, fold the day's deltas into `qty` and delete the old motion rows — keeps the DB small.

| Step | Action |
| :--- | :--- |
| 1 | `qty = qty + SUM(deltas after mark)` |
| 2 | `mark = last folded seq` |
| 3 | Export folded motion rows to S3 |
| 4 | Delete them from motion |

Never `VACUUM` a synced replica.

## Write-Path Rules

| Rule | Why |
| :--- | :--- |
| No `INSERT OR REPLACE` — use `ON CONFLICT DO UPDATE ... WHERE changed` | REPLACE dirties every index even on no-op saves |
| One transaction per logical event | One frame per page, not many |
| Debounced `schedulePush()` (2–5s) | Hot pages shipped once |

## Estimated Effect

| Lever | Saving |
| :--- | :--- |
| motion 5 btrees → 1 + column drops | 50–60% of motion sync |
| epoch ints / enums / variant ordinals | 15–25% further |
| qty checkpoint | 40–50% of sale-path frames |
| in-place phase + archival | 70–85% of lifecycle traffic |
| cart local-only, catalog global-only | 30–60% of motion volume |
| batching / upsert / debounced push | 2–10x on bursty traffic |

Compounded: **5–10x** vs v1.

## Cost at Chennai Scale (vs `plan.md` §7)

Per-flow math above gives 9.5–16x; budgeted at a conservative **5x** — anything better is upside.

Sync unit: figures assume libSQL embedded replicas (physical WAL pages). Turso's newer CDC sync ships logical row changes instead — the btree-count lever vanishes (indexes aren't synced), but fewer/smaller/local-only rows still apply; both baselines shrink, gap narrows to ~3–5x.

| | v1 | v2 |
| :--- | :--- | :--- |
| Sync bandwidth | 9,600 GB | 1,920 GB |
| **Turso / mo** | **$2,498.92** | **$498.92** |
| INR / mo | ₹2,08,660 | ₹41,660 |

Saving: **$2,000 / mo (₹1.67 lakh) — 80% off.** Infra drops to 0.08% of revenue; AI tokens become the dominant cost.
