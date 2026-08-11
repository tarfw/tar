---
type: WorkspaceDesign
version: 1
clone_reference: kith.com
clone_extracted_at: 2026-08-10T23:30:00Z
template: kith
vertical: luxury-streetwear
---

# KITH Streetwear & Lifestyle Design System (DESIGN.md)

## Brand Identity
- **Name**: KITH Streetwear & Lifestyle
- **Vibe**: High-fashion luxury streetwear, monochrome high contrast, boxy sharp geometry, bold uppercase typography with wide letter-spacing.

## Colors
```yaml
colors:
  primary: "#000000"         # Pure Monochrome Black
  primaryHover: "#111111"
  background: "#FFFFFF"      # Pure Bright White
  surface: "#F5F5F5"         # Off-White Light Gray Surface
  text: "#000000"            # High Contrast Black Text
  muted: "#999999"           # Silver Gray Muted Text
  border: "rgba(0,0,0,0.1)"  # Subtle Border
  secondary: "#E5E5E5"       # Light Neutral Gray
```

## Typography
```yaml
typography:
  fontHeading: "Inter"
  fontBody: "Inter"
  headingWeight: "700"
  bodyWeight: "400"
  scale:
    display:  { size: 88, weight: 700, lineHeight: 1.05, tracking: 0.08, transform: "uppercase" }
    h1:       { size: 56, weight: 700, lineHeight: 1.1,  tracking: 0.08, transform: "uppercase" }
    h2:       { size: 36, weight: 700, lineHeight: 1.2,  tracking: 0.1,  transform: "uppercase" }
    h3:       { size: 24, weight: 600, lineHeight: 1.3,  tracking: 0.05, transform: "uppercase" }
    body:     { size: 15, weight: 400, lineHeight: 1.5,  tracking: 0 }
    caption:  { size: 12, weight: 400, lineHeight: 1.4,  tracking: 0 }
    eyebrow:  { size: 11, weight: 600, lineHeight: 1.0,  tracking: 0.15, transform: "uppercase" }
```

## Spacing + Grid
```yaml
spacing:
  section_v: 80px
  section_v_mobile: 48px
  container: 1440px
  gutter: 20px
  card_gap: 16px

grid:
  columns: 12
  product_cols: 4
  product_cols_mobile: 2
```

## Shape + Surface
```yaml
rounded:
  card: 0px           # Sharp zero-radius boxy geometry
  button: 0px         # Sharp rectangular buttons
  tag: 0px
  image: 0px

surfaces:
  card_surface:
    background: "#F5F5F5"
    border: "1px solid rgba(0,0,0,0.08)"
  section_dark:
    background: "#000000"
```

## Motion + Animation
```yaml
motion:
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)"
  duration_fast: 200ms
  duration_normal: 350ms
  product_hover:
    type: zoom
    scale: 1.04
```

## Interactions
```yaml
interactions:
  nav_sticky: true
  button_hover: opacity(0.85)
  lookbook_zoom: true
```

## Sections Manifest
```yaml
sections:
  - id: sec_01_announcement
    type: announcement_bar
    variant: kith-marquee
    contract:
      height: 36px
      bg: "#000000"
      color: "#ffffff"
      font_size: 11px
      tracking: 0.15em
      transform: uppercase

  - id: sec_02_header
    type: header_nav
    variant: kith-3col-header
    contract:
      height: 56px
      bg: "#ffffff"
      border: "1px solid #e5e5e5"
      left_links: ["NEW", "MENS", "WOMENS", "KIDS"]
      logo_text: "KITH"
      logo_tracking: 0.3em

  - id: sec_03_hero_carousel
    type: hero_carousel
    variant: fullbleed-carousel
    contract:
      height: 75vh
      min_height: 480px
      bg_overlay: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)"
      title_scale: display
      cta_style: sharp-white-btn

  - id: sec_04_summer_hero
    type: section_hero
    variant: fullwidth-story-banner
    contract:
      height: 70vh
      eyebrow: "NEW DELIVERY"
      headline: "Kith Summer 2026"
      buttons: ["Mens", "Womens"]

  - id: sec_05_lookbook_1
    type: lookbook_grid
    variant: 4col-hover-zoom
    contract:
      columns: 4
      gap: 12px
      aspect_ratio: "3/4"
      hover_zoom: 1.04

  - id: sec_06_kin_hero
    type: section_hero
    variant: fullwidth-story-banner
    contract:
      height: 70vh
      eyebrow: "LIFESTYLE"
      headline: "&Kin Summer 2026"
      buttons: ["Shop &Kin"]

  - id: sec_07_lookbook_2
    type: lookbook_grid
    variant: 4col-hover-zoom
    contract:
      columns: 4
      gap: 12px
      aspect_ratio: "3/4"
      hover_zoom: 1.04

  - id: sec_08_products
    type: product_grid
    variant: kith-product-card
    contract:
      columns: 4
      gap: 16px
      aspect_ratio: "3/4"
      show_badge: true
      show_brand: true
      cta_style: uppercase-cart-btn

  - id: sec_09_newsletter
    type: newsletter
    variant: dark-subscribe-strip
    contract:
      bg: "#000000"
      text_color: "#ffffff"
      button_style: sharp-white-btn

  - id: sec_10_footer
    type: footer
    variant: kith-minimal-footer
    contract:
      bg: "#ffffff"
      text_color: "#999999"
      copyright: "© 2026 KITH RETAIL LLC. ALL RIGHTS RESERVED."
```

## Design Rules
- NEVER use rounded corners on buttons or cards (radius is ALWAYS 0px)
- ALL section titles and eyebrows must be uppercase with wide letter-spacing
- Product images must be crisp 3/4 aspect ratio with light neutral surface backgrounds
- Nav bar must remain clean 3-column layout with center KITH branding
