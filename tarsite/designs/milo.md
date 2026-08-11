---
type: WorkspaceDesign
version: 1
clone_reference: milopet.com
clone_extracted_at: 2026-08-11T02:40:00Z
template: milo
vertical: pet-care-insurance
language: en
---

# Milo Pet Care & Insurance Design System (DESIGN.md)

## Brand Identity
- **Name**: Milo Pet Care & Insurance
- **Vibe**: Friendly, trustworthy, modern pet health care, warm cream canvas (#FAF7F2), bright pet green (#1FCB60), deep forest dark green (#032E1C), Marcellus serif headings, pill rounded buttons (9999px).

## Colors
```yaml
colors:
  primary: "#1FCB60"         # Bright Pet Green
  primaryHover: "#1BB154"
  secondary: "#032E1C"       # Deep Forest Dark Green
  tertiary: "#B5EB79"        # Lime Accent Green
  background: "#FAF7F2"      # Warm Off-White Cream
  surface: "#FFFFFF"         # Pure Bright White Surface
  text: "#032E1C"            # High Contrast Dark Forest Text
  muted: "#64748B"           # Slate Gray Muted Text
  border: "rgba(3,46,28,0.08)"
```

## Typography
```yaml
typography:
  fontHeading: "Marcellus"
  fontBody: "Montserrat"
  headingWeight: "700"
  bodyWeight: "400"
  scale:
    display:  { size: 64, weight: 700, lineHeight: 1.1,  tracking: 0,    transform: "none" }
    h1:       { size: 48, weight: 700, lineHeight: 1.15, tracking: 0,    transform: "none" }
    h2:       { size: 36, weight: 700, lineHeight: 1.2,  tracking: 0,    transform: "none" }
    h3:       { size: 24, weight: 600, lineHeight: 1.3,  tracking: 0,    transform: "none" }
    body:     { size: 16, weight: 400, lineHeight: 1.6,  tracking: 0 }
    caption:  { size: 13, weight: 400, lineHeight: 1.4,  tracking: 0 }
    eyebrow:  { size: 11, weight: 700, lineHeight: 1.0,  tracking: 0.15, transform: "uppercase" }
```

## Spacing + Grid
```yaml
spacing:
  section_v: 80px
  section_v_mobile: 48px
  container: 1200px
  gutter: 24px
  card_gap: 24px

grid:
  columns: 12
  product_cols: 4
  product_cols_mobile: 1
```

## Shape + Surface
```yaml
rounded:
  card: 20px          # Soft rounded pet cards
  button: 9999px      # Full pill buttons
  tag: 9999px
  image: 20px

surfaces:
  card_surface:
    background: "#FFFFFF"
    border: "1px solid rgba(3,46,28,0.08)"
  section_dark:
    background: "#032E1C"
```

## Motion + Animation
```yaml
motion:
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)"
  duration_fast: 200ms
  duration_normal: 350ms
  card_hover:
    type: lift
    translateY: -4px
```

## Interactions
```yaml
interactions:
  nav_sticky: true
  nav_blur: "blur(16px)"
  button_hover: scale(1.02)
```

## Sections Manifest
```yaml
sections:
  - id: sec_01_announcement
    type: announcement_bar
    variant: milo-announcement
    contract:
      bg: "#032E1C"
      color: "#1FCB60"
      font_size: 11px
      tracking: 0.15em
      text: "100% VET EXPENSE REIMBURSEMENT | DIGITAL PET INSURANCE | NO HIDDEN FEES"

  - id: sec_02_header
    type: header_nav
    variant: milo-glass-header
    contract:
      height: 64px
      bg: "rgba(250,247,242,0.9)"
      blur: "16px"
      logo: "milo."
      button_shape: pill
      button_text: "Get Your Price 🐾"

  - id: sec_03_hero
    type: media_hero
    variant: milo-split-hero
    contract:
      layout: split-2col
      eyebrow_badge: "COMPREHENSIVE PET HEALTH INSURANCE"
      floating_badge: "✓ 100% Fast Reimbursement"
      cta_primary: "green-pill"

  - id: sec_04_features
    type: content_grid
    variant: milo-feature-cards
    contract:
      columns: 4
      gap: 24px
      card_radius: 20px

  - id: sec_05_checklist
    type: story_banner
    variant: milo-dark-checklist
    contract:
      bg: "#032E1C"
      text_color: "#FFFFFF"
      list_type: checkmarks

  - id: sec_06_calculator
    type: action_strip
    variant: milo-price-calculator
    contract:
      bg: "#B5EB79"
      button_style: green-pill
      title: "How Much Does Protecting Your Dog Cost?"

  - id: sec_07_footer
    type: footer
    variant: milo-footer
    contract:
      bg: "#032E1C"
      copyright: "© 2026 MILO PET CARE INC. ALL RIGHTS RESERVED."
```
