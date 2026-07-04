---
type: Reference
title: OKF + OriginTrail DKG integration
description: How OKF bundles become verifiable, owned knowledge on the Decentralized Knowledge Graph — provenance, ownership, and trust for AI agents.
resource: https://medium.com/origintrail/googles-okf-comes-to-the-origintrail-dkg-a-memory-ai-agents-can-trust-43c6d87e1de8
tags: [okf, dkg, origintrail, provenance, verifiable, trust]
timestamp: 2026-07-04T00:00:00Z
---

# OKF + OriginTrail DKG Integration

OKF gives agents portable knowledge. The DKG gives that knowledge **provenance, ownership, and verifiability**. Together they turn a static bundle into living memory any agent can trust.

## The Problem OKF Alone Doesn't Solve

OKF is portable text. But take away who wrote it and whether it has been altered, and you get text that *looks* authoritative and **proves nothing**. Google itself lists "trust tiers" among v0.1's open questions.

| What OKF provides | What OKF lacks |
|---|---|
| Portable markdown bundles | Who wrote it |
| Cross-links between concepts | Whether it was altered |
| YAML frontmatter for metadata | Cryptographic proof |
| Human + agent readable | Ownership model |

## What the DKG Adds

The Decentralized Knowledge Graph turns OKF concepts into **Knowledge Assets** with three properties:

| Property | Meaning |
|---|---|
| **Cryptographically authored** | You know who asserted it |
| **Owned** | Accountable origin, not drifting unattributed |
| **Verifiable** | A machine can check it, not take it on faith |

## How the Import Works

```bash
dkg okf import <bundle> --context-graph-id <cg> --create-context-graph --share
```

Key properties of the import:

| Property | Detail |
|---|---|
| **No LLM** | Pure deterministic mapping. Same bundle = byte-identical triples every time |
| **Cross-links → edges** | OKF markdown links become untyped directed edges in the graph |
| **No embellishment** | What was written is what gets remembered |
| **Reproducible** | Anyone can re-run import and get the same graph |

## Architecture: OKF → DKG → Agents

```
OKF Bundle                    DKG Context Graph (RDF)           Agents
─────────                    ────────────────────────           ──────
okf-bundle/                  Verifiable Memory
  index.md                   (on-chain, owned, verifiable)     Agent A
  orders.md                       │
  customers.md                Shared Working Memory
                              (sealed, Merkle + EIP-712,
                               peer-visible)                   Agent B
                                      │
                              Working Memory
                              (private draft)
                                                               Agent C
                              provenance · ownership · verifiability
                              added by the DKG
```

## Three Memory Layers

| Layer | Storage | Properties |
|---|---|---|
| **Verifiable Memory** | On-chain | Owned, verifiable, permanent |
| **Shared Working Memory** | Sealed | Merkle + EIP-712, peer-visible |
| **Working Memory** | Private draft | Internal, not yet provenanced |

## Demo: Treasury Bundle with Two Sources

Real provenance problem: Strategy Inc (MSTR) Bitcoin treasury, disclosed via SEC Form 8-K filings + SaylorTracker dashboard.

### Before DKG

OKF bundle with two sources per transaction:

```yaml
type: Bitcoin Treasury Transaction
title: Strategy BTC acquisition, 2026-04-13 to 2026-04-19
btc_delta: 34164
avg_price: 74395
tags: [mstr, bitcoin, acquisition, edgar-verified]
```

```markdown
# Provenance
Primary source: [SEC EDGAR](../sources/sec-edgar.md), Form 8-K announced 2026-04-20.
Reconciliation: [SaylorTracker](../sources/saylortracker.md), derived dashboard.

# Citations
[1] SEC Form 8-K, Strategy Inc (CIK 0001050446), 2026-04-20 — authoritative.
[2] SaylorTracker — cross-check.
```

Provenance exists as prose. Readable, but not queryable or provable.

### After DKG

Each citation becomes a first-class edge. Each source becomes a node. The agent can now:

- Query which transactions are EDGAR-verified
- Reconcile the two sources
- Prove the chain from holdings figure back to the 8-K filing
- Verify the Merkle root + EIP-712 attestation

## Why This Matters for tarflue-v2

### Workspace Knowledge Trust

| Scenario | Without DKG | With DKG |
|---|---|---|
| Agent reads product catalog | Markdown file — could be stale | Verifiable asset — timestamped, owned |
| Agent reads return policy | Text — no proof of who wrote it | Cryptographically authored |
| Agent reads report definition | Portable but not provable | Owned by the workspace, verifiable |
| Marketplace skill install | Copy rows — trust the source? | DKG-verified skill with provenance |

### Multi-Agent Trust

| Problem | DKG Solution |
|---|---|
| Agent A and Agent B both read the same OKF bundle | Both verify the same provenance |
| Agent modifies a concept | DKG detects the alteration |
| New agent joins | Can verify all knowledge it reads |
| Workspace shares data with partner | Partner agent can verify authenticity |

### Action Memory + DKG

| Layer | What | Trust Level |
|---|---|---|
| OKF bundle | Curated knowledge | Portable but unverified |
| Action memory | Cached agent decisions | Fast but not provenanced |
| DKG-imported OKF | Verifiable knowledge assets | Owned, provenanced, verifiable |

## Use Cases for Our System

| Use Case | How DKG Helps |
|---|---|
| **Product catalog trust** | Workspace owner publishes products as verifiable assets. Buyer agent verifies authenticity. |
| **Invoice/receipt verification** | Documents linked via graph become verifiable. Tax authority can trace. |
| **Cross-workspace data sharing** | Restaurant shares supplier data with delivery partner. Both verify provenance. |
| **Marketplace skills** | Skills published on DKG. Installing agent verifies source and integrity. |
| **Report definitions** | Tax report SQL is a verifiable asset. Auditor can verify the query hasn't changed. |

## Getting Started

| Step | What |
|---|---|
| 1 | Launch a DKG node: `github.com/OriginTrail/dkg` |
| 2 | Import OKF bundle: `dkg okf import ./OKF/system --create-context-graph --share` |
| 3 | Agents query the DKG instead of reading raw markdown |
| 4 | Verify provenance before acting on any knowledge |

## Future: Agents Pay for Knowledge

The x402 protocol enables HTTP "402 Payment Required" for agents:

1. Agent discovers a dataset on the DKG
2. Owner's endpoint quotes a price
3. Agent pays in stablecoins/TRAC tokens
4. Access opens — no human in the loop

Knowledge that can be owned, proven, and permissioned becomes sellable. The trust properties that make it trustworthy are the same ones that make it sellable.

## References

- [OriginTrail DKG](https://origintrail.io/technology/decentralized-knowledge-graph)
- [OKF Spec](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
- [DKG GitHub](https://github.com/OriginTrail/dkg)
- [Medium article](https://medium.com/origintrail/googles-okf-comes-to-the-origintrail-dkg-a-memory-ai-agents-can-trust-43c6d87e1de8)
