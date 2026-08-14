---
type: WorkspaceDesign
version: 1
clone_reference: planhat.com
template: planhat
vertical: tech-editorial
---

# Planhat — Cinematic Monochrome Style Reference (DESIGN.md)

## Brand Identity
- **Name**: Planhat Tech & Editorial
- **Vibe**: Cinematic darkroom print on cold-pressed paper, photographic warmth fading into black, ultra-tight tracking display typography, generous whitespace.

## Colors
```yaml
colors:
  primary: "#000000"         # Obsidian Neutral Black
  primaryHover: "#121211"
  background: "#FFFFFF"      # Pure Paper White
  surface: "#F8F8F7"         # Warm Taupe Surface
  text: "#121211"            # Deep Ink High Contrast Text
  muted: "#575551"           # Graphite Muted Text
  border: "rgba(0,0,0,0.08)" # Hairline Border
  secondary: "#958D7E"       # Warm Stone
  accent: "#E8552B"          # Ember Tag Focus Accent
```

## Typography
```yaml
typography:
  fontHeading: "Inter"
  fontBody: "Inter"
  headingWeight: "700"
  bodyWeight: "400"
  scale:
    display:  { size: 96, weight: 700, lineHeight: 1.02, tracking: -0.06 }
    h1:       { size: 56, weight: 700, lineHeight: 1.1,  tracking: -0.04 }
    h2:       { size: 36, weight: 700, lineHeight: 1.2,  tracking: -0.03 }
    h3:       { size: 24, weight: 600, lineHeight: 1.3,  tracking: -0.02 }
    body:     { size: 16, weight: 400, lineHeight: 1.5,  tracking: 0 }
    caption:  { size: 12, weight: 400, lineHeight: 1.4,  tracking: 0 }
    eyebrow:  { size: 10, weight: 600, lineHeight: 1.0,  tracking: 0.1, transform: "uppercase" }
```

## Spacing + Grid
```yaml
spacing:
  section_v: 80px
  section_v_mobile: 48px
  container: 1280px
  gutter: 24px
  card_gap: 24px

grid:
  columns: 12
  product_cols: 3
  product_cols_mobile: 1
```

## Shape + Surface
```yaml
rounded:
  card: 4px           # Clean modern tight 4px radius
  button: 4px         # 4px modern tactile buttons
  tag: 999px
  image: 4px

surfaces:
  card_surface:
    background: "#FFFFFF"
    border: "1px solid rgba(0,0,0,0.08)"
  section_dark:
    background: "#000000"
```

## Sections Manifest
```yaml
sections:
  - id: sec_01_announcement
    type: announcement_bar
    variant: promo_bar
    contract:
      height: 36px
      bg: "#000000"
      text_color: "#ffffff"
      font_size: 11px
      tracking: 0.12em
      transform: uppercase
    props:
      text: "Planhat Platform 2026 Release · Now Live"

  - id: sec_02_header
    type: header_nav
    variant: sticky_glass
    contract:
      sticky: true
      backdrop_blur: "16px"
      bg: "rgba(255,255,255,0.9)"
      cta_bg: "#000000"
      cta_text: "#ffffff"
      cta_shape: "rounded"
    props:
      brand_name: "Planhat"
      cta_label: "Get Started ›"

  - id: sec_03_hero
    type: hero_banner
    variant: hero_split
    contract:
      layout_mode: "split"
      height: "75vh"
      cta_bg: "#000000"
      cta_text: "#ffffff"
    props:
      badge: "CUSTOMER SUCCESS PLATFORM"
      headline: "The modern operating system for customer success."
      subtitle: "Give your team real-time insights, automated health scores, and collaborative playbooks in one unified canvas."
      ctaText: "Start Free Trial"
      secondaryCtaText: "Book Demo ›"
      image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1000&h=800&fit=crop"

  - id: sec_04_features
    type: product_grid
    variant: feature_cards
    contract:
      columns: 3
      gap: "24px"
      card_bg: "#FFFFFF"
      card_border: "1px solid rgba(0,0,0,0.08)"
      card_radius: "4px"
      hover_zoom: 1.04
    props:
      title: "Engineered for Clarity & Scale"
      subtitle: "Everything you need to deliver world-class client retention."
      items:
        - title: "Unified Data Canvas"
          description: "Connect product usage, billing, and CRM into one real-time customer profile."
          image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=450&fit=crop"
        - title: "Automated Playbooks"
          description: "Trigger proactive workflows when customer engagement signals risk or opportunity."
          image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&h=450&fit=crop"
        - title: "Executive Revenue Portal"
          description: "Forecast renewals, NRR growth, and expansion revenue with board-ready dashboards."
          image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=450&fit=crop"

  - id: sec_05_story
    type: story_banner
    variant: dark_editorial
    contract:
      bg: "#121211"
      text_color: "#FFFFFF"
    props:
      title: "Trusted by Modern SaaS Leaders"
      subtitle: "From high-growth scaleups to enterprise teams managing millions in ARR."
      highlights:
        - "SOC2 Type II and GDPR compliant"
        - "Sub-100ms real-time metric updates"
        - "Native Salesforce, HubSpot & Snowflake integrations"
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=800&fit=crop"

  - id: sec_06_footer
    type: footer_strip
    variant: footer
    props:
      text: "© 2026 Planhat Inc. All Rights Reserved."
```
