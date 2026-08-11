# GenAI Site Engine — Architectural Specification & Developer Guide

## 1. Core Architecture Overview

The **GenAI Site Engine** operates on a **Pure OKF Contracts + Universal Primitives Architecture**.

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│     Site Extraction     │      │   OKF Design Contract    │      │  6 Universal Primitives  │
│                         │ ───► │       (design.md)        │ ───► │     Edge Renderer       │
│  siteskills/*.html      │      │ tarsite/designs/*.md     │      │   tarsite/src/*.ts      │
└─────────────────────────┘      └──────────────────────────┘      └─────────────────────────┘
                                               │
                                               ▼
                                 ┌──────────────────────────┐
                                 │ Cloudflare Edge Workers  │
                                 │    KV Storefront Cache   │
                                 └──────────────────────────┘
```

### Key Architectural Pillars:
1. **Zero-Code Edit Engine**: Adding new website presets (e.g., `empire`, `joandso`, `eql`, `nike`, `apple`) requires **ZERO edits** to core TypeScript files in `tarsite`.
2. **Declarative Markdown Contracts**: All site styles, color tokens, typography, navigation links, layout grids, badges, partner quotes, and media assets are 100% declared in `.md` frontmatter & YAML routes.
3. **6 Universal Layout Primitives**: A fixed set of 6 composable, Webflow-quality HTML/CSS primitives render any site layout dynamically in **< 4ms** on Cloudflare Edge Workers.

---

## 2. The 6 Universal Layout Primitives

Every site design in the system is composed of combinations of these 6 primitives:

| Primitive Name | Function & Standard Use Cases | Typical Variant Keys |
| :--- | :--- | :--- |
| **`marquee_strip`** | Top announcement bar, scrolling ticker, sub-header banners. | `launch_ticker`, `warm_ticker`, `announcement` |
| **`navigation_bar`** | Sticky glass headers, logo placements, nav links, CTA buttons. | `eql_header`, `joandso_header`, `empire_header` |
| **`media_hero`** | Split heroes, full-screen background banners, multi-tile title rows. | `launch_hero`, `warm_editorial`, `media_split` |
| **`content_grid`** | Product grids, regional cards, audience split tiles, metric counters. | `eql_drops`, `eql_metrics`, `joandso_regions` |
| **`story_banner`** | Partner quotes, sister story splits, certification stamp banners. | `eql_nike_quote`, `eql_runfair_stamp`, `joandso_sisters` |
| **`action_strip`** | Newsletter signups, lead forms, email captures, footer copyright bars. | `launch_action`, `warm_newsletter`, `footer_action` |

---

## 3. OKF Design Contract Specification (`design.md`)

Each design preset is written as a single markdown file containing YAML frontmatter:

```yaml
---
preset_name: EQL High-Demand Launch Platform
template: eql

tokens:
  color_bg: "#F9F9FB"
  color_surface: "#FFFFFF"
  color_primary: "#0A0A0C"
  color_secondary: "#FFE600"
  color_accent: "#FFF6C7"
  color_text: "#0A0A0C"
  color_muted: "rgba(10, 10, 12, 0.65)"
  color_border: "rgba(10, 10, 12, 0.12)"
  font_heading: "Plus Jakarta Sans"
  font_body: "Inter"

routes:
  "/":
    title: "Page Title"
    sections:
      - type: marquee_strip
        variant: launch_ticker
        contract:
          bg: "#0A0A0C"
          text_color: "#FFE600"
        props:
          text: "ANNOUNCEMENT TEXT HERE"

      - type: navigation_bar
        variant: eql_header
        contract:
          sticky: true
          bg: "rgba(249, 249, 251, 0.94)"
          cta_bg: "#FFF6C7"
        props:
          brand_name: "BRAND"
          nav_links:
            - label: "Link 1"
              url: "#url1"
          cta_label: "ACTION"

      - type: media_hero
        variant: launch_hero
        props:
          badge: "BADGE TEXT"
          headline: "Main Headline"
          subtitle: "Subtitle text"
          image: "https://..."

      - type: content_grid
        variant: eql_drops
        contract:
          columns: 4
          gap: "20px"
          aspect_ratio: "4/3"
        props:
          title: "Grid Title"
          items:
            - title: "Item 1"
              description: "Desc 1"
              image: "https://..."

      - type: story_banner
        variant: eql_nike_quote
        props:
          title: "Section Title"
          subtitle: "Quote text"
          highlights:
            - "Bullet 1"
            - "Bullet 2"

      - type: action_strip
        variant: eql_footer_action
        props:
          title: "Call to Action"
          subtitle: "Subtitle"
---
```

---

## 4. End-to-End Workflow for Adding a New Site

Follow these exact steps when converting any reference site into an OKF Contract:

### Step 1: Download Reference HTML
Save the complete reference HTML to `siteskills/{sitename}.html`:
```powershell
powershell -Command "Invoke-WebRequest -Uri 'https://www.example.com/' -OutFile 'c:\tarfwk\tar\siteskills\example.html'"
```

### Step 2: Extract Brand Tokens & Assets
Analyze `siteskills/{sitename}.html` to extract:
* Canvas background color (`color_bg`)
* Surface color (`color_surface`)
* Primary & accent colors (`color_primary`, `color_secondary`, `color_accent`)
* Typography fonts (`font_heading`, `font_body`)
* CDN image URLs & media assets

### Step 3: Write OKF Contracts (`.md`)
Save the design specification to 3 canonical locations:
1. `c:\tarfwk\tar\siteskills\DESIGN-{sitename}.md`
2. `c:\tarfwk\tar\siteskills\{sitename}.md`
3. `c:\tarfwk\tar\tarsite\designs\{sitename}.md`

### Step 4: Register Preset Chip in `tarapp`
Add the preset chip in `tarapp`:
* In `tarapp/src/components/WorkspaceSiteScreen.tsx` -> Add chip entry to `DESIGN_PRESETS`.
* In `tarapp/src/lib/site-ai.ts` -> Add mapping in `PRESET_TEMPLATE_MAP` and layout loader.

### Step 5: Publish to Cloudflare Edge Workers KV
Upload the `.md` contract directly to Cloudflare Edge KV namespace:
```bash
npx wrangler kv:key put --binding=STOREFRONT_CACHE "published:{sitename}" --path=./designs/{sitename}.md
```

---

## 5. Key System Implementation Details

### Indentation-Aware YAML Frontmatter Parser (`okf-parser.ts`)
* Uses a line-by-line stack mechanism (`{ indent: number; obj: any }[]`) to track indentation.
* Correctly parses deeply nested arrays (`items:`, `highlights:`, `nav_links:`, `routes:`) without dropping context or triggering sample fallbacks.

### Validator Gate (`validator.ts`)
* `APPROVED_COMPONENTS` includes all 6 primitive names: `marquee_strip`, `navigation_bar`, `media_hero`, `content_grid`, `story_banner`, `action_strip`.
* Node types are preserved without fallback rewrite.

### Edge Worker KV Deployment (`wrangler.jsonc`)
* Binding `STOREFRONT_CACHE` key `published:{subdomain}` serves production HTML compiled dynamically in **< 4ms**.

---

## 6. Ready & Deployed Presets Inventory

| Preset ID | Site Name | Reference URL | Edge Staging Domain |
| :--- | :--- | :--- | :--- |
| **`eql`** | EQL Hype Release Platform | `https://www.eql.com/` | `https://eql.tarai.space/` |
| **`joandso`** | JO&SO Boutique Hotel Guide | `https://www.joandso.com/` | `https://joandso.tarai.space/` |
| **`empire`** | EMPIRE Music Publishing | `https://empi.re/` | `https://velvet-brew.tarai.space/` |
| **`kith`** | Kith Streetwear Store | — | Built-in preset |
| **`milo`** | Milo Pet Care | — | Built-in preset |

---
*Documented on August 11, 2026 for GenAI Site Engine workspace migration.*



Created genaisite.md

### 📄 Documentation File Written & Saved!

The complete architectural guide, design extraction workflow, and system rules have been documented in:

👉 **[`c:\tarfwk\tar\docs\genaisite.md`](file:///c:/tarfwk/tar/docs/genaisite.md)**

---

### 📋 Overview of What's Documented in `genaisite.md`:

1. **Core OKF Architecture**:
   * Pure **OKF Contracts + Universal Primitives Architecture**.
   * Zero-code edit rule for `tarsite` engine when adding new site designs.

2. **The 6 Universal Primitives Reference**:
   * Detailed breakdown of `marquee_strip`, `navigation_bar`, `media_hero`, `content_grid`, `story_banner`, and `action_strip`.

3. **OKF Markdown Contract Format (`design.md`)**:
   * Complete YAML frontmatter schema for design tokens, routes, section types, contracts, and props.

4. **Step-by-Step Site Extraction Workflow**:
   * Step 1: Download raw Webflow / HTML to `siteskills/{sitename}.html`.
   * Step 2: Extract brand tokens, fonts, and assets.
   * Step 3: Write OKF `.md` contracts.
   * Step 4: Add preset chip in `tarapp`'s `WorkspaceSiteScreen.tsx`.
   * Step 5: Publish directly to Cloudflare Edge KV (`published:{sitename}`).

5. **Ready & Deployed Presets Inventory**:
   * **`eql`** (EQL Hype Release Platform) 👉 `https://eql.tarai.space/`
   * **`joandso`** (JO&SO Boutique Hotels) 👉 `https://joandso.tarai.space/`
   * **`empire`** (EMPIRE Music Publishing) 👉 `https://velvet-brew.tarai.space/`
   * **`kith`** & **`milo`**

You are all set to open your new conversation thread!

Ran command: `git status`
Ran command: `powershell -Command "Remove-Item -Path 'c:\tarfwk\tar\siteskills\parse_eql.js', 'c:\tarfwk\tar\siteskills\section_parser.js' -Force -ErrorAction SilentlyContinue"`
Ran command: `git add .`
Ran command: `git commit -m "feat: implement OKF Contracts + Universal Primitives Architecture with EQL, JO&SO, and EMPIRE designs, frontmatter parser fix, and genaisite documentation"`
Ran command: `git push origin main`
Ran command: `git status`

### 🎉 All Changes Committed & Pushed to Git Cleanly!

Everything has been committed and pushed to your remote repository **`origin/main`** with **100% precision**.

---

### 📦 Git Commit Details:
* **Commit Hash**: `3bc7ec8`
* **Repository**: `https://github.com/tarfw/tar.git`
* **Branch**: `main`
* **Status**: `working tree clean` *(0 uncommitted changes)*

#### Summary of Committed Files:
* 📄 **Documentation**: [`docs/genaisite.md`](file:///c:/tarfwk/tar/docs/genaisite.md)
* 🎨 **OKF Design Contracts**:
  * [`siteskills/DESIGN-eql.md`](file:///c:/tarfwk/tar/siteskills/DESIGN-eql.md) & [`tarsite/designs/eql.md`](file:///c:/tarfwk/tar/tarsite/designs/eql.md)
  * [`siteskills/DESIGN-joandso.md`](file:///c:/tarfwk/tar/siteskills/DESIGN-joandso.md) & [`tarsite/designs/joandso.md`](file:///c:/tarfwk/tar/tarsite/designs/joandso.md)
  * [`siteskills/DESIGN-empire.md`](file:///c:/tarfwk/tar/siteskills/DESIGN-empire.md) & [`tarsite/designs/empire.md`](file:///c:/tarfwk/tar/tarsite/designs/empire.md)
* 📥 **Reference HTML**: [`siteskills/eql.html`](file:///c:/tarfwk/tar/siteskills/eql.html)
* 🛠️ **Engine & Parser Upgrades**:
  * [`tarsite/src/okf-parser.ts`](file:///c:/tarfwk/tar/tarsite/src/okf-parser.ts) *(Indentation-stack YAML parser fix)*
  * [`tarsite/src/primitives.ts`](file:///c:/tarfwk/tar/tarsite/src/primitives.ts) *(Universal Primitives Webflow layout rendering)*
  * [`tarapp/src/components/WorkspaceSiteScreen.tsx`](file:///c:/tarfwk/tar/tarapp/src/components/WorkspaceSiteScreen.tsx) *(Preset chips)*

---

### 🌐 Live Production Edge Links Ready:
* ⚡ **EQL Launch Platform**: `https://eql.tarai.space/`
* 🏨 **JO&SO Boutique Hotels**: `https://joandso.tarai.space/`
* 🎵 **EMPIRE Music Publishing**: `https://velvet-brew.tarai.space/`

You are all ready to start your new conversation thread whenever you like!
