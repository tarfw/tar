# AI Site Design System — Final Plan
## `design.md` + OKF Catalogue Architecture

**Document status:** Finalized  
**Covers:** tarapp workspace site generation, end-to-end  
**Date:** 2026-08-06

---

## 1. Problem Statement

The current site generation system in tarapp produces inconsistent, model-dependent output because the LLM is asked to make every design decision at runtime — colors, fonts, section layout, spacing, motion, and content — in a single API call. The quality degrades significantly with smaller models, fails silently with hardcoded fallbacks, and cannot support clone-quality fidelity. There is no persistent design knowledge per workspace; every generation starts from zero.

The goal of this plan is to replace that system with one where design intelligence is **pre-authored, catalogued, and deterministic** — and the LLM's role is reduced to filling in business-specific content into a pre-defined, high-fidelity design system.

---

## 2. Core Principle

> **Design quality is determined by the catalogue. Content quality is determined by the model. These are completely independent axes.**

The new system separates two things that are currently conflated:

- **Design language** — colors, typography, spacing, section structure, motion, interaction rules. This is curated by the team, stored as `design.md`, and never regenerated after workspace creation.
- **Content** — headlines, product names, subtitles, testimonials, CTAs. This is AI-generated from the workspace's business context and fills into slots defined by the design.md.

---

## 3. Current System — How It Works Today

### 3.1 The Flow

When a user creates a workspace and opens their site, the current system does the following:

1. User types a workspace name and picks a business vertical (6 options).
2. `handleCreateInlineWorkspace()` in `workspaces.tsx` calls `tar.createWorkspace()`.
3. The Cloudflare Worker scaffolds OKF files in S3: `index.md`, `skills/*.md`, `team/members.md`.
4. When the site is first opened, `generateSiteLayout()` in `site-ai.ts` fires a single GROQ API call using `openai/gpt-oss-120b`.
5. The LLM receives a large system prompt (~2000 tokens) containing all design rules, all template descriptions, and all anti-slop rules.
6. The LLM returns a JSON `SiteLayout` object with `template`, `theme`, and `sections[]`.
7. If the LLM fails or returns invalid JSON, one of three hardcoded fallback functions (`createFallbackLayout`) runs, returning a static layout.
8. The layout is rendered by `WorkspaceSiteScreen`.

### 3.2 Current Responsibilities — What the LLM Decides

In the current system, the LLM is asked to decide all of the following in a single call:

- Which template to use (1 of 6 hardcoded options)
- What color palette to apply (primary, secondary, background, surface, text)
- Which font pair to use (heading + body)
- Which sections to include and in what order
- What section variants to use
- What the section content should be (headlines, subtitles, CTA labels, testimonials)
- Anti-slop rules (no emoji in headlines, no electric blue for food sites)
- Badge text, announcement bar copy, footer text

### 3.3 Current Architecture Files

| File | Purpose |
|---|---|
| `src/lib/site-ai.ts` | GROQ API call + system prompt + JSON extraction |
| `src/lib/site-schema.ts` | TypeScript types: SiteLayout, Theme, Section, TemplateName |
| `src/lib/storefront-ai.ts` | Older storefront layout generator (legacy) |
| `src/lib/storefront-schema.ts` | Legacy storefront types |
| `src/lib/design-tokens.ts` | Token parsing (colors, typography, rounded, spacing) |
| `src/lib/design-parser.ts` | Partial OKF markdown parser (only colors/rounded/spacing) |
| `src/lib/layout-engine.ts` | YAML frontmatter parser for skills/*.md module layouts |
| `src/lib/drinkpouch.md` | One-off aesthetic reference file (not loaded at runtime) |
| `src/gen-ui/registry/` | Section renderers: EntityDirectory, MetricCard, DataTable, etc. |

### 3.4 Current System — Problems

| Problem | Impact |
|---|---|
| LLM decides all design in one call | Output quality varies wildly by model |
| 6 hardcoded templates only | Every similar business gets identical-looking sites |
| 3 hardcoded fallback functions (350 lines) | Fallback = generic, not brand-matched |
| No streaming | User waits 3–5 seconds before anything renders |
| No AI image generation | Hero and editorial sections have no real imagery |
| Custom YAML parser | Brittle, breaks on edge cases, hard to extend |
| No persistent design knowledge | Each generation starts from zero |
| Full regeneration on edit | Changing one section costs 3000+ tokens |
| No section-level design contracts | Renderer approximates layout, not pixel-faithful |
| drinkpouch.md not loaded at runtime | Aesthetic rules exist but are never applied |

---

## 4. Planned System — The New Architecture

### 4.1 The Core Idea: design.md as the Brain

Every workspace gets a `design.md` file stored in its OKF S3 bucket. This file is the complete design intelligence for that workspace. It defines:

- The full color token system (every shade, every semantic color)
- The full typography scale (display, h1–h6, body, caption, label, mono — with exact sizes, weights, line-heights, and letter-spacing)
- Spacing, grid, shape, and shadow tokens
- An ordered sections manifest (which sections appear, in what order, with what variant and contract props)
- Design rules (what is forbidden, what must always be true)
- Motion and animation definitions (easing curves, durations, scroll behaviors)
- Interaction definitions (hover states, sticky nav, custom cursor rules)
- An images manifest (which sections need AI-generated images, with generation prompts)
- Intent hooks (which chat phrases map to which layout patches)

The AI populates content into `design.md` once at workspace creation. After that, the site loads instantly from a Turso cache. The AI only touches `design.md` again when the user explicitly requests a change via chat.

### 4.2 The getdesign.md Catalogue

Instead of generating a `design.md` from scratch for every workspace, the team maintains a curated library of pre-authored `design.md` files. This catalogue is the foundation of the system and is entirely independent of any LLM call.

The catalogue is a managed collection — versioned, reviewed, and structured — where each entry is a complete `design.md` representing a distinct design language. Not a brand clone, but a design system that captures the essential visual intelligence of a reference aesthetic.

Examples of catalogue entries:

- `apple-inspired-2024` — SF Pro Display, minimal whitespace, dark hero, tight 2px product grid gaps, text-link CTAs, blur-glass sticky nav, scroll-reveal animations
- `stripe-precision-2024` — Clean SaaS, indigo accent, illustration-friendly, generous padding, two-tone surfaces
- `linear-dark-2024` — Developer-focused, dark canvas, monospace accents, speed-focused motion
- `notion-warm-2024` — Off-white paper canvas, blue primary, Inter font, wiki-like sections
- `lululemon-sport-2024` — White canvas, red primary, square corners, activewear editorial
- `drinkpouch-editorial-2024` — Chalk background, navy + pulse blue, Playfair Display, marquee loops
- `aesop-luxury-2024` — Deep muted tones, serif headings, luxury spacing, no CTAs above fold
- `airbnb-warm-2024` — Warm surfaces, Cereal font, friendly rounded corners, map-capable sections

The catalogue is exposed via an API and a browsing UI. Users pick a design language during workspace creation. The chosen file is copied to the workspace S3 bucket as `design.md`. No LLM call is needed for this step.

### 4.3 The Three-Layer Pipeline

Every workspace site is produced by three independent, sequential layers.

**Layer 1 — Design Language Selection (Catalogue)**
The user browses the getdesign.md catalogue and selects a design language. The selected `design.md` is fetched from the catalogue API and written to the workspace's S3 bucket. This step requires no AI. It happens once, at workspace creation.

**Layer 2 — Content Population (LLM — small model)**
A Content Agent reads the `design.md` sections manifest and the workspace's business context (name, vertical, products from Turso). It fills the content slots in each section — headlines, subtitles, CTA labels, product descriptions, announcement bar text, footer copyright. It does not touch any design token, section order, variant, or contract property. Only content fields are written. This step costs approximately 200–400 tokens.

**Layer 3 — Compilation and Rendering (Deterministic)**
The design-md-compiler reads the populated `design.md` and produces a SiteLayout JSON object. This is a pure, deterministic function — no AI involved. The JSON is saved to a Turso matter row as type: site_layout. Every subsequent page load reads from Turso and renders immediately. The AI is not in the load path.

### 4.4 Chat-Based Editing (Patch-Only)

When the user types a site edit instruction in the workspace chat, the system:

1. Checks intent_hooks in design.md to find the best-matching hook.
2. Loads only the relevant section node from design.md (not the entire file).
3. Sends that section (approximately 150 tokens) plus the user instruction to the AI.
4. The AI returns a patched version of that section only.
5. The patched section is written back to design.md in S3.
6. The compiler re-runs for the affected section.
7. The Turso cache is updated.
8. The site re-renders with the change.

A structural edit (adding or removing a section) follows the same flow but sends the sections manifest rather than a single section node (approximately 400 tokens). A full design overhaul simply replaces design.md with a different catalogue entry and reruns content population.

### 4.5 Image Generation

The images block in design.md declares which sections require AI-generated imagery and provides a generation prompt for each. After design.md is first written, a background Image Agent reads the images block, generates each image in parallel, and stores the results in the workspace's assets/ folder in S3. Section config image fields are updated with the asset paths and the generated flag is set to true. Subsequent loads use the cached images.

### 4.6 Section Contracts

Each section type and variant is governed by a Section Contract — a structured document that defines the exact visual and behavioral specification for that section. Contracts live in a section-contracts/ directory in the OKF file structure.

A Section Contract defines:
- Required and optional config fields
- Exact layout properties (grid columns, gap, padding, aspect ratios)
- Typography role assignments (which field uses which type scale token)
- Color role assignments (which surface uses which color token)
- Hover and focus state behavior
- Scroll and animation behavior
- Anti-patterns (what must never appear in this section)

The renderer reads section contracts alongside design.md tokens to produce pixel-faithful output. Every prop in the contract is executed by the renderer. There is no approximation.

---

## 5. Current vs Planned — Full Comparison

### 5.1 Architecture

| Dimension | Current | Planned |
|---|---|---|
| Design knowledge location | Baked into system prompt string in site-ai.ts | Lives in design.md per workspace, in S3, versioned |
| Design source | LLM generates at runtime | Pre-curated catalogue, selected by user |
| Template options | 6 hardcoded presets | Unlimited catalogue entries |
| Fallback system | 3 hardcoded fallback functions (350 lines) | design.md is the fallback — already on disk |
| Persistent design knowledge | None — every generation starts fresh | design.md persists in S3 forever |
| Site load path | May include AI call | Pure Turso cache read — 0 AI calls |
| Edit cost | Full regeneration (2000–4000 tokens) | Patch single section (150–400 tokens) |
| Image generation | Not supported | Declared in design.md, generated async |
| Section-level contracts | None | Full contracts per section type and variant |
| Streaming | Not supported | Section-by-section compilation possible |

### 5.2 Design Quality

| Dimension | Current | Planned |
|---|---|---|
| Color system depth | 5 tokens (primary, secondary, bg, surface, text) | Full token system (12+ semantic colors) |
| Typography system | 2 font names only (heading, body) | Full type scale: display, h1–h6, body, caption, label, mono |
| Spacing system | None — renderer approximates | Explicit token set: xs, sm, md, lg, xl, xxl, section_v |
| Shape system | None | rounded, shadow, surface variants |
| Motion definitions | None | Easing curves, durations, scroll reveal, stagger rules |
| Interaction rules | None | Hover states, sticky behaviors, custom cursor rules |
| Anti-slop enforcement | In system prompt (model may ignore) | In design.md design rules block (compiler enforces) |
| Grid contracts | Approximate | Exact: columns, gap, aspect ratios, image positions |

### 5.3 LLM Dependency

| Decision | Current — LLM Decides | Planned — LLM Decides |
|---|---|---|
| Color palette | Yes — high model dependency | No — from catalogue |
| Font selection | Yes — high model dependency | No — from catalogue |
| Spacing values | Yes — often ignored | No — from catalogue |
| Section order | Yes — inconsistent | No — from catalogue |
| Section variants | Yes — rarely correct | No — from catalogue |
| Motion curves | No — never produced | No — from catalogue |
| Hover states | No — never produced | No — from catalogue |
| Section content (headlines) | Yes | Yes — still model-dependent |
| Content–section mapping | Yes — often mismatched | Yes — easier, slots are defined |
| Anti-slop compliance | Yes — model may ignore | No — enforced by compiler |

**Summary:** In the current system the LLM makes approximately 40 design decisions per generation. In the planned system it makes approximately 3 — catalogue selection if not user-picked, content filling, and minor personalisation on request. Design quality becomes model-independent. Content quality remains model-dependent but is a much simpler task.

### 5.4 Token Costs

| Operation | Current | Planned |
|---|---|---|
| First workspace site | 2000–4000 tokens | 200–400 tokens (content fill only) |
| Subsequent site loads | 0 (cached JSON) | 0 (Turso cache) |
| Chat edit: color change | 2000 tokens (full regen) | 150 tokens (single token patch) |
| Chat edit: add section | 2000 tokens (full regen) | 400 tokens (section manifest append) |
| Chat edit: full redesign | 2000 tokens | 0 (swap catalogue entry, refill content) |
| Image generation | Not supported | Async, parallel, no LLM tokens |

### 5.5 Operational

| Dimension | Current | Planned |
|---|---|---|
| YAML parsing | Custom brittle handwritten parser | Structured design.md markdown spec |
| Fallback quality | Generic hardcoded templates | Catalogue entry (full design fidelity) |
| Team editability | Cannot edit design without code changes | Edit design.md in S3 — no deployment needed |
| Version control | None | design.md is a text file — diffable, committable |
| Clone quality | Approximate (guessed from text prompt) | Section-contract-driven, pixel-faithful |
| Model flexibility | Locked to powerful model for acceptable output | Small fast model sufficient for 95% of operations |

---

## 6. The design.md File — What It Contains

A design.md file is a structured markdown document with the following top-level blocks.

**Frontmatter block** — metadata: workspace ID, vertical, catalogue reference ID, template name, version, generation timestamp.

**Colors block** — full semantic color token system. Minimum tokens: primary, primaryHover, background, surface, surfaceDark, text, textSecondary, textInverse, textLink, muted, accent, danger, success.

**Typography block** — font family declarations for heading, body, and mono. Full type scale with size, weight, line-height, and letter-spacing for: display, h1, h2, h3, body, caption, label, eyebrow.

**Spacing and grid block** — named spacing tokens (xs through xxl), section vertical padding, container max-width, content gutter, card gap.

**Shape block** — named border-radius tokens, named shadow tokens, named surface style tokens (e.g. glass morphism surfaces).

**Motion block** — named easing curves, duration tokens (fast/normal/slow), and named animation definitions for hero reveal, product hover, nav scroll behavior, and scroll-triggered reveal.

**Interactions block** — boolean or value declarations for: sticky nav, nav blur on scroll, custom cursor, scroll reveal, hover lift, button scale on hover, 3D tilt (usually false).

**Design rules block** — plain-English constraints the renderer and content agent must always respect. These replace the anti-slop rules currently in the system prompt.

**Sections manifest block** — the ordered list of sections. Each entry declares: section ID, section type, variant, and a contract block with exact prop values for that section instance. This is the most important block — it defines the complete page structure.

**Images block** — for each section requiring a visual: the generation prompt, the target asset path in S3, and a generated flag.

**Intent hooks block** — phrase-to-action mappings used by the chat patch engine to route edit instructions without an LLM disambiguation step.

---

## 7. The getdesign.md Catalogue System

### 7.1 What It Is

The getdesign.md catalogue is a managed library of pre-authored design.md files maintained by the tarapp team. It functions as a design language registry — analogous to npm for packages or Shadcn/UI for components, but for full site design systems.

Each entry is a complete, validated design.md file that has been authored, reviewed, and tested against the renderer. Entries are versioned with year suffixes (e.g. apple-inspired-2024) so that workspaces referencing a specific entry always get the same design, regardless of future catalogue updates.

### 7.2 Catalogue Entry Metadata

Each entry carries:

- `catalogue_id` — unique stable identifier
- `catalogue_name` — human-readable display name
- `catalogue_version` — semver or year tag
- `catalogue_tags` — visual style descriptors (minimal, editorial, bold, luxury, dark, warm)
- `catalogue_verticals` — suitable business verticals (tech, retail, food, wellness, saas, fashion)
- `catalogue_sections_count` — number of sections in the manifest
- `catalogue_preview` — path to a preview image of the rendered design
- `catalogue_curated_by` — author attribution

### 7.3 User Experience

During workspace creation, the user is presented with a catalogue browser. They can filter by visual style or business vertical and preview each design language. Selecting an entry copies that design.md to the workspace S3 bucket. The user can also skip selection and let the AI pick the closest match based on their business name and vertical.

After workspace creation, the user can change their design language at any time. The new design.md replaces the old one, content is re-populated, and the Turso cache is updated.

### 7.4 Planned Initial Catalogue Entries

| Catalogue ID | Visual Style | Best For |
|---|---|---|
| apple-inspired-2024 | Minimal, dark hero, precise | Tech, consumer hardware, SaaS |
| stripe-precision-2024 | Clean, illustrated, indigo | Payments, SaaS, developer tools |
| linear-dark-2024 | Dark, fast, monospace | Developer tools, productivity |
| notion-warm-2024 | Warm paper, blue, editorial | Productivity, docs, wikis |
| lululemon-sport-2024 | White, red, square, athletic | Activewear, fitness, sport |
| drinkpouch-editorial-2024 | Chalk, navy, serif, marquee | Beverages, supplements, DTC |
| aesop-luxury-2024 | Muted, serif, generous space | Beauty, luxury, boutique retail |
| airbnb-warm-2024 | Warm, rounded, community | Services, marketplace, travel |
| vercel-dark-2024 | Dark, gradient, developer | Hosting, infra, developer tools |
| organic-cafe-2024 | Terracotta, cream, warm | Café, bakery, food, dining |
| clinic-clean-2024 | Clinical white, blue, trustworthy | Healthcare, clinic, wellness |
| real-estate-pro-2024 | Premium, map-ready, dark | Property, real estate, listings |

---

## 8. Clone Quality — How It Is Achieved

### 8.1 What Clone Quality Means

When a user asks the system to produce a site following the design language of a reference like Apple or Stripe, clone quality means the section structure matches the reference, every color token matches, the full typography scale matches, the grid specification matches, the motion behavior matches, and the interaction behavior matches.

Clone quality is not about duplicating content. The content is replaced with the workspace's own business content. The design language is replicated faithfully.

### 8.2 What Determines Clone Quality

Clone quality is determined by two independent factors: the depth and accuracy of the design.md catalogue entry, and the renderer's ability to faithfully execute section contracts. The team controls both. The LLM is not involved in this fidelity.

### 8.3 Design Language vs Content — The Strict Boundary

**Design language (always from catalogue):** Colors, fonts, spacing, section types, section order, section variants, grid specs, aspect ratios, padding, gap, border-radius, shadow, motion curves, interaction behaviors, design rules.

**Content (always from AI or user):** Headline text, subtitle text, CTA labels, product names and descriptions, testimonial quotes and authors, announcement bar copy, footer copyright text, image generation prompts.

This boundary is enforced at the compiler level. The content population step can only write to defined content fields.

### 8.4 The Style Mixer

Once the catalogue is established, users can combine design languages: Apple's section structure with Notion's colors and Drinkpouch's typography. The compiler treats each design.md block independently, making token-level mixing trivial. This is impossible with hardcoded templates and becomes natural with the catalogue architecture.

---

## 9. LLM Model Strategy

### 9.1 Which Model for Which Operation

| Operation | Model Needed | Reason |
|---|---|---|
| Catalogue selection (if user skips) | flash-lite | Simple matching task |
| Content population (headline, subtitle, CTA) | flash | Copy generation |
| Chat patch: single token or content change | flash-lite | Minimal context needed |
| Chat patch: section content update | flash | Copy generation |
| Chat patch: structural layout change | pro | Design and layout reasoning required |
| Custom design.md from scratch (no catalogue) | pro | Full design system creation |

### 9.2 Quality Axes

Design quality and content quality are fully independent in this system. A workspace can have world-class visual design (from a well-crafted catalogue entry) and average content (from a cheap fast model) and still look excellent. Upgrading the model improves copy. Changing the catalogue entry changes the entire visual direction. Neither affects the other.

With the catalogue system in place, 95% of workspace creations only need a small fast model, because the hard design thinking is pre-done by the team who authored the catalogue entries.

---

## 10. File Structure — Current vs Planned

### 10.1 Existing Files and Their Planned Status

| File | Planned Status | Notes |
|---|---|---|
| src/lib/site-ai.ts | Modified | Becomes a thin shim calling the new compiler |
| src/lib/site-schema.ts | Keep | Types remain valid |
| src/lib/design-tokens.ts | Keep | Token parsing already works |
| src/lib/design-parser.ts | Modified | Extended to parse full design.md spec |
| src/lib/layout-engine.ts | Keep | Module layout builder unchanged |
| src/lib/intent-resolver.ts | Modified | Loads intent_hooks from design.md |
| src/lib/tools.ts | Keep | 6 CRUD tools unchanged |
| src/lib/tar.ts | Keep | HTTP client unchanged |
| src/gen-ui/registry/ | Modified | Renderer components upgraded for contract fidelity |

### 10.2 New Files to Create

| File | Purpose |
|---|---|
| src/lib/design-md-ai.ts | Populates content into a catalogue design.md from business context |
| src/lib/design-md-compiler.ts | Compiles design.md into SiteLayout JSON — deterministic, no AI |
| src/lib/design-patch-ai.ts | Patches a single section or token in design.md from chat instruction |
| src/lib/design-image-gen.ts | Generates images declared in the design.md images block |
| src/lib/catalogue-client.ts | Fetches design.md entries from the getdesign.md catalogue API |

### 10.3 New OKF Structure Per Workspace

```
workspace S3 bucket
├── index.md                     workspace identity (unchanged)
├── design.md                    THE BRAIN — copied from catalogue, content populated
├── skills/
│   ├── inventory.md             module logic (unchanged)
│   ├── orders.md
│   └── bookings.md
├── section-contracts/
│   ├── hero_banner.md           per-section design specifications
│   ├── product_grid.md
│   ├── announcement_bar.md
│   └── footer.md
└── assets/
    ├── hero.png                 AI-generated, stored after first creation
    └── editorial.png
```

---

## 11. Implementation Phases

### Phase 1 — design.md Specification and Catalogue Foundation

Define the complete design.md file format specification. Author the first batch of catalogue entries (minimum 6). Set up the catalogue storage and API endpoint. This phase is primarily content work by the team, not engineering.

Deliverables: Formal design.md spec. Six or more authored and reviewed design.md catalogue entries. Catalogue API returning entries by ID.

### Phase 2 — Catalogue Client and design.md Compiler

Build catalogue-client.ts to fetch entries from the catalogue API. Build design-md-compiler.ts to transform a populated design.md into a SiteLayout JSON object. Update site-ai.ts to call the compiler. This phase replaces the existing JSON generation path.

Deliverables: catalogue-client.ts. design-md-compiler.ts. Updated site-ai.ts shim. WorkspaceSiteScreen renders from compiled output unchanged.

### Phase 3 — Content Population Agent

Build design-md-ai.ts to take a catalogue design.md and a business context and populate the content fields. This is a focused, low-token AI call that only writes to content slots. Replace the current full-design system prompt.

Deliverables: design-md-ai.ts. New content-only system prompt. Token cost per workspace drops from 3000+ to under 400.

### Phase 4 — Turso Persistent Cache

Persist the compiled SiteLayout JSON to a Turso matter row on first compilation. On subsequent loads, read from Turso first and render immediately. Background-check S3 for design.md changes and recompile if the content hash has changed.

Deliverables: Updated use-site.ts hook with Turso read-first logic. All subsequent site loads become instant.

### Phase 5 — Chat Patch Engine

Build design-patch-ai.ts. Hook into the existing workspace chat system via intent-resolver.ts. Load intent_hooks from design.md to route chat instructions. Patch only the target section node, recompile, update Turso cache.

Deliverables: design-patch-ai.ts. Updated intent-resolver.ts. Chat commands work via patch, not full regen.

### Phase 6 — Image Generation Pipeline

Build design-image-gen.ts. Run as a background task after design.md is first written. Generate each declared image in parallel, store in workspace assets/ in S3, update the generated flag in design.md.

Deliverables: design-image-gen.ts. Hero and editorial sections have real imagery on first site view.

### Phase 7 — High-Fidelity Renderer Upgrade

Upgrade the gen-ui/registry/sections/ components to execute section contracts faithfully. Each renderer must honor exact grid specs, aspect ratios, padding values, hover states, and scroll behaviors defined in the contract.

Deliverables: Upgraded section renderers. Motion and interaction blocks from design.md are executed visually. Grid gaps, type scales, and aspect ratios are exact.

### Phase 8 — Catalogue Expansion and Browsing UI

Author section-contracts/ files for each section type. Expand the catalogue to 20+ entries. Build the catalogue browsing UI with filter by style and vertical, and preview cards. Launch getdesign.md as a public-accessible catalogue.

Deliverables: 20+ catalogue entries. Section contract files for all section types. Catalogue browsing UI integrated into workspace creation flow.

---

## 12. What Does Not Change

The following systems are unaffected by this plan and remain exactly as they are:

- tools.ts — 6 CRUD operations (create, read, update, delete, link, search)
- tar.ts — HTTP client to the Cloudflare Worker backend
- All skills/*.md module logic (inventory, orders, bookings, CRM, etc.)
- WorkspaceCanvas and module dashboard rendering
- intent-resolver.ts keyword engine (extended with intent_hooks, not replaced)
- OKF file access via tar.okf.read() and tar.okf.upload()
- Workspace creation flow in workspaces.tsx (only the site generation step changes)
- Turso database schema and sync logic
- All auth, ACL, and team membership systems

---

## 13. Summary

The planned system makes one fundamental architectural shift: design intelligence moves from a runtime LLM call into a pre-authored, version-stable file stored in the workspace. The LLM no longer designs. It fills in content. Design is the responsibility of the catalogue. Rendering is the responsibility of the contract-faithful renderer.

```
Current:
  User creates workspace
  → LLM designs everything in one call (40 design decisions, 3000+ tokens)
  → JSON blob returned
  → Rendered approximately
  → Slow, expensive, model-dependent, inconsistent quality

Planned:
  User picks catalogue entry (or AI picks — cheap, fast)
  → design.md written to workspace S3 — one-time, no design AI
  → AI fills content only (~300 tokens, small model)
  → Compiler builds SiteLayout JSON → saved to Turso
  → Every load: read Turso → render in under 100ms, zero AI in load path
  → Chat edit: patch single node in design.md (~150 tokens) → recompile → Turso updated
  → Fast, cheap, model-independent design quality, consistent at any scale
```

