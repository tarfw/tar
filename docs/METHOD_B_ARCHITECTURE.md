# METHOD B OPEN DESIGN SYSTEM & DEPLOYMENT ARCHITECTURE

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Issue
Even after updating `renderSectionsToHtml` to extract section contracts from Markdown files (`DESIGN-lululemon.md`), the live storefront (`https://storea.tarai.space`) continued displaying old hardcoded styles/content.

### 1.2 Root Causes
1. **Fallback Render Loop in Site Renderer**: `handleSiteRequest` in `site-renderer.ts` evaluates multiple fallback paths. When `home.json` in S3 was stored without an explicit `template: "lululemon"` parameter, `renderSectionsToHtml` defaulted back to `minimal-white` or fallback styling.
2. **Missing Property Mapping in Contract Interpolator**: AI-generated JSON layouts frequently produce field name variations (e.g. `headline` vs `title`, `ctaText` vs `cta`, `secondaryCtaText` vs `cta2Text`). The `.md` parser was performing exact key replacement (`{{title}}`), resulting in empty string evaluation when field aliases were present.
3. **Hardcoded Global Header Override**: `renderHeaderNav()` was being executed and prepended *before* section node processing, rendering the old generic header on top of the `.md`-defined navigation bar.

---

## 2. End-to-End System Architecture

```
[ User Action: Tap Preset ]
            │
            ▼
[ WorkspaceSiteScreen.tsx ] ──(passes preset.id as templateHint)──► [ site-ai.ts ]
                                                                        │
                                                    (forces template: "lululemon")
                                                                        │
                                                                        ▼
                                                             [ site/layouts/home.json ]
                                                                        │
                                                           (Uploaded via /publish endpoint)
                                                                        │
                                                                        ▼
                                                              [ Cloudflare Worker ]
                                                                        │
                                                            (handleSiteRequest in site-renderer.ts)
                                                                        │
                                                                        ▼
                                                             [ gen-ui/renderer.ts ]
                                                                        │
                                                     (getDesignSections("lululemon"))
                                                                        │
                                                                        ▼
                                                           [ md-section-parser.ts ]
                                                                        │
                                                (Parses section contracts & interpolates props)
                                                                        │
                                                                        ▼
                                                          [ Live HTML Output ]
```

---

## 3. Key Components & Implementation

### A. Markdown Spec & HTML/CSS Contracts
File: [`c:/tarfwk/tar/docs/DESIGN-lululemon.md`](file:///c:/tarfwk/tar/docs/DESIGN-lululemon.md)
Embedded Spec: [`c:/tarfwk/tar/taragent/src/gen-ui/design-specs-registry.ts`](file:///c:/tarfwk/tar/taragent/src/gen-ui/design-specs-registry.ts)

Every section is defined with clean HTML contracts and scoped CSS rules:
- `section_00_announcement_bar`
- `section_01_header_nav`
- `section_02_hero_banner`
- `section_03_category_tiles`
- `section_04_product_grid`
- `section_05_perks_bar`
- `section_06_editorial_split`
- `section_07_activity_discovery`
- `section_08_community_banner`
- `section_09_footer`

### B. Markdown Section Parser (`md-section-parser.ts`)
File: [`c:/tarfwk/tar/taragent/src/gen-ui/md-section-parser.ts`](file:///c:/tarfwk/tar/taragent/src/gen-ui/md-section-parser.ts)
- Extracts ```html and ```css blocks from section headings (e.g. `### section_02_hero_banner`).
- `dedent()` strips common leading indentation from code fences.
- `interpolate(template, props)` replaces `{{variable}}` placeholders without escaping HTML/URLs.

### C. Primary Renderer Engine (`renderer.ts`)
File: [`c:/tarfwk/tar/taragent/src/gen-ui/renderer.ts`](file:///c:/tarfwk/tar/taragent/src/gen-ui/renderer.ts)
- **Normaliser**: Maps AI property aliases (`headline` -> `title`, `secondaryCtaText` -> `cta2Text`, `subtext` -> `subtitle`).
- **Pure Method B Execution**: `renderNode` evaluates `getDesignSections(template)` first. Hardcoded Method A TypeScript functions have been completely decoupled.

### D. App Layout Generator (`site-ai.ts`) & UI Screen (`WorkspaceSiteScreen.tsx`)
Files:
- [`c:/tarfwk/tar/tarapp/src/components/WorkspaceSiteScreen.tsx`](file:///c:/tarfwk/tar/tarapp/src/components/WorkspaceSiteScreen.tsx)
- [`c:/tarfwk/tar/tarapp/src/lib/site-ai.ts`](file:///c:/tarfwk/tar/tarapp/src/lib/site-ai.ts)

- Pressing a preset chip passes `templateHint` (e.g. `'lululemon'`).
- `generateSiteLayout` forces `layout.template = forcedTemplate` (overriding LLM variations).

---

## 4. Deployment Instructions for Next Thread

When starting a new conversation thread, execute these steps to ensure changes are synced live:

1. **Verify Local Code Changes**:
   ```powershell
   cd c:\tarfwk\tar\taragent
   npx tsc --noEmit
   ```

2. **Deploy Cloudflare Worker**:
   ```powershell
   npx wrangler deploy
   ```

3. **Trigger Fresh Site Publish in App**:
   - Tap the **Lululemon** preset button in the App Site screen.
   - Tap **Publish Site to Live**.
   - Navigate to `https://storea.tarai.space` to verify live Method B rendering.
