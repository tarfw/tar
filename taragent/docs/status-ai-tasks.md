# AI Tasks — Implementation Status

## Phase A: Server (Parser + Endpoint)

| # | Task | File | Done? |
|---|---|---|---|
| A1 | SKILL.md parser | `src/lib/skill-parser.ts` (413 lines) | YES |
| A2 | GET /ai-tasks endpoint | `src/app.ts:204` | YES |
| A3 | Compact LLM index | `skill-parser.ts:403` | YES |

## Phase B: Client API

| # | Task | File | Done? |
|---|---|---|---|
| B1 | tar.aiTasks() + tar.executeAITask() | `src/lib/tar.ts:57-67` | YES |
| B2 | Fetch on tab open | `workspace.tsx:67` | YES |
| B3 | Search bar | `workspace.tsx:273` | YES |

## Phase C: UI Components

| # | Task | File | Done? |
|---|---|---|---|
| C1 | AI Tasks tab | `workspace.tsx:181,256` | YES |
| C2 | AITaskCard component | `components/AITaskCard.tsx` (173 lines) | YES |
| C3 | AITaskForm component | `components/AITaskForm.tsx` (236 lines) | YES |
| C4 | Submit handler | `workspace.tsx:138` | YES |

## Phase D: LLM Channel Path

| # | Task | File | Done? |
|---|---|---|---|
| D1 | Compact index in system prompt | `app.ts:544` | YES |
| D2 | Action executor | `src/lib/action-executor.ts` (467 lines) | YES |
| D3 | Agent route rewrite | `app.ts:569-628` | YES |

## Phase E: Cleanup

| # | Task | File | Done? |
|---|---|---|---|
| E1 | Remove hardcoded skills.ts | `src/lib/skills.ts` | NO - still exists |
| E2 | Remove debug endpoints | `src/app.ts` | NO - /debug/s3 still there |

## Summary

| Phase | Total | Done | Remaining |
|---|---|---|---|
| A - Server | 3 | 3 | 0 |
| B - Client API | 3 | 3 | 0 |
| C - UI | 4 | 4 | 0 |
| D - LLM | 3 | 3 | 0 |
| E - Cleanup | 2 | 0 | 2 |
| **TOTAL** | **15** | **13** | **2** |

## Remaining Work

1. Delete `src/lib/skills.ts` (hardcoded RESTAURANT_SKILLS no longer needed)
2. Remove `/debug/s3` endpoint from `app.ts`
