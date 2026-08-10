# System Audit & Discovery (`AUDIT.md`)

## 1. Overview & Current Legacy Architecture Audit

This document maps all route handlers, legacy parsers, component registries, and database schemas currently present in [`taragent`](file:///c:/tarfwk/tar/taragent) and [`tarapp`](file:///c:/tarfwk/tar/tarapp), and establishes the clean cutover roadmap for **`tarsite`** (`c:\tarfwk\tar\tarsite`).

---

## 2. Discovered Systems & Redundancy Analysis

### Redundant Renderer Pathways in `taragent/src/site-renderer.ts`
1. **S3 `home.json` Section Renderer**: Looks for `site/layouts/home.json` in OKF/S3 storage and renders section blocks via `renderSectionsToHtml`.
2. **D1 `getActiveRevision()` Revision Plan Renderer**: Queries D1 `revisions` table for active revision plans and renders via `gen-ui/renderer.ts`.
3. **KV Cache `DESIGN.md` + `pages.md` Template Matcher**: Parses `DESIGN.md` tokens and `site/pages.md` YAML routes to match hardcoded templates (`hero`, `catalog-grid`, `cart`, `checkout`, `booking-widget`, `contact`).
4. **Hardcoded HTML Fallback Placeholder**: Returns string `"Setting up - The workspace storea is currently being initialized."` when no configuration is found.

### Deficiencies Identified
- **Fragmented Schemas**: Schema specs split between `tarapp/src/lib/site-schema.ts` (sections array) and `taragent/src/gen-ui/types.ts` (recursive UINode tree).
- **Missing `/publish` API Endpoint**: `tarapp` posts layouts to `POST /publish`, but `taragent/src/app.ts` lacks an explicit handler, causing published layouts to fail to update KV/D1 and resulting in the `"Setting up"` screen.
- **Single-Route Bias**: Legacy renderers only look at `routes[0]`, lacking full multi-route path matching (`/catalog`, `/product/:id`, `/cart`).
- **Code Bloat**: `taragent` combines heavy agentic CRM tools, S3 document storage, and inbox event execution with site rendering logic.

---

## 3. Clean Cutover Architecture (`tarsite`)

The new **`tarsite`** engine (`c:\tarfwk\tar\tarsite`) decouples site rendering entirely:

```
┌──────────────────────────────────────────────────────────────────┐
|                       tarsite STANDALONE ENGINE                  |
├──────────────────────────────────────────────────────────────────┤
| 1. src/types.ts         -> Unified UIPlan & DesignTokens schema |
| 2. src/skill-manifest.ts -> Capability-based SkillManifest API    |
| 3. src/planner.ts       -> Staged Multi-Agent Generator         |
| 4. src/validator.ts     -> Structural/Referential/Data-Flow Gate |
| 5. src/resolver.ts      -> Server Resource Database Data Binder   |
| 6. src/router.ts        -> Parameterized Multi-Route Matcher      |
| 7. src/renderer.ts      -> Hardened Edge HTML Compiler (< 5ms)    |
| 8. src/app.ts           -> Hono Edge Server for *.tarai.space     |
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Migration & API Cutover Plan

1. **`tarsite` Scaffolding**: Create clean Hono/Cloudflare Worker project in `c:\tarfwk\tar\tarsite`.
2. **`UIPlan` Versioned Contracts**: Port and standardize `UIPlan` TypeScript/Zod contracts.
3. **Skill Manifest & Multi-Agent Planner**: Implement capability-based skill router and staged generator.
4. **Validation Gate**: Implement strict structural, referential, and data-flow validation.
5. **Edge HTML Compiler & Router**: Implement parameterized path router and hardened single HTML compiler.
6. **Publishing API**: Expose `POST /publish`, `POST /draft`, and `POST /gen-site/clone`.
7. **`tarapp` & `taragent` Connection**: Point `tarapp` site editor directly to `tarsite` worker.
