---
type: Agent
title: Master agent
description: The main agent that detects user intent and routes to the correct workflow. Uses cheap LLMs only.
resource: tarflue-v2://src/agents/master.ts
tags: [agent, master, intent, routing]
timestamp: 2026-07-04T00:00:00Z
---

# Master agent

The entry point for all user messages. Detects intent, picks a workflow, and routes execution.

## Flow

```
User input
  → LLM detects intent ("record_sale")
  → RBAC check (group membership via D1)
  → Load workflow (wf_record_sale)
  → Run workflow (no LLM)
  → Reply
```

## Key principle

**The LLM runs once.** Everything after that is deterministic JSON execution. This is how we keep costs under ₹100/user/month.

## Intent detection

The agent uses a cheap LLM (Groq GPT-OSS-120B) to detect:

| Intent | Example |
|---|---|
| `record_sale` | "Record sale of 3 Pepsi" |
| `check_stock` | "How much Pepsi do we have?" |
| `create_lead` | "New lead: Ravanan, 98765" |
| `run_report` | "Show me today's sales" |
| `book_appointment` | "Book haircut for tomorrow 3pm" |

## LLM tiering

| Tier | What | Latency | Cost |
|---|---|---|---|
| L1 | Static dictionary match | 0ms | $0 |
| L2 | Action memory replay | 20-50ms | $0 |
| L3 | Semantic cache | 50ms | Very low |
| L4 | Cheap LLM (intent only) | 500ms | Low |
| L5 | Strong LLM (complex) | 2s | High |

Agent tries L1 → L2 → L3 → L4. L5 only for exceptional cases.

## Models

| Use case | Model | Cost |
|---|---|---|
| Intent detection | Groq GPT-OSS-120B | ~₹40/M IO |
| Site layout gen | MiMo v2.5 | ~₹12 input, ₹24 output |
| Simple replies | Llama 3.1 8B on Groq | ~₹15/M IO |

## Related

- [Action Memory](/agents/action-memory.md) — zero-cost replay
- [Workflows](/workflows/index.md) — what the agent routes to
