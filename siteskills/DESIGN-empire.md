---
preset_name: EMPIRE Global Music Label
template: empire

tokens:
  color_bg: "#000000"
  color_surface: "#0A0A0A"
  color_primary: "#FFFFFF"
  color_secondary: "#1A1A1A"
  color_accent: "#E50914"
  color_text: "#FFFFFF"
  color_muted: "rgba(255, 255, 255, 0.65)"
  color_border: "rgba(255, 255, 255, 0.12)"
  font_heading: "Inter Tight"
  font_body: "Inter"

routes:
  "/":
    title: "EMPIRE – Independent Label & Global Music Publisher"
    sections:
      - type: marquee_strip
        variant: black_ticker
        contract:
          bg: "#000000"
          text_color: "#E50914"
          font_size: "11px"
          letter_spacing: "0.22em"
          speed: "18s"
        props:
          text: "EMPIRE PUBLISHING · GLOBAL MUSIC DISTRIBUTION · HIP-HOP / AFROBEATS / LATIN / R&B · INDEPENDENT FOREVER"

      - type: navigation_bar
        variant: empire_header
        contract:
          sticky: true
          bg: "rgba(0, 0, 0, 0.92)"
          backdrop_blur: "24px"
          logo_position: "left"
          cta_bg: "#FFFFFF"
          cta_text: "#000000"
          cta_shape: "square"
        props:
          brand_name: "EMPIRE"
          nav_links:
            - label: "ARTISTS"
              url: "#artists"
            - label: "RELEASES"
              url: "#releases"
            - label: "PUBLISHING"
              url: "#publishing"
            - label: "DISTRIBUTION"
              url: "#distribution"
            - label: "ABOUT"
              url: "#about"
          cta_label: "SUBMIT DEMO"

      - type: media_hero
        variant: cinematic_dark
        contract:
          layout_mode: "overlay"
          height: "85vh"
          cta_bg: "#FFFFFF"
          cta_text: "#000000"
        props:
          badge: "INDEPENDENT LABEL & GLOBAL PUBLISHER"
          headline: "ELEVATING GLOBAL MUSIC TALENT."
          subtitle: "Direct-to-DSP distribution, sync licensing, and financial transparency for independent artists worldwide."
          ctaText: "EXPLORE ROSTER"
          secondaryCtaText: "PUBLISHING ADMIN ›"
          image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1920&h=1080&fit=crop"

      - type: content_grid
        variant: empire_roster
        contract:
          columns: 4
          gap: "20px"
          aspect_ratio: "1/1"
          hover_zoom: 1.08
          card_bg: "#0A0A0A"
          card_border: "1px solid rgba(255,255,255,0.12)"
          card_radius: "0px"
        props:
          title: "FEATURED RELEASES & ARTISTS"
          subtitle: "Global chart-topping independent music across Hip-Hop, Afrobeats, Latin, and R&B."
          items:
            - title: "Asake"
              desc: "Lunky · Afrobeats"
              image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop"
            - title: "Shaboozey"
              desc: "A Bar Song (Tipsy) · Country / Hip-Hop"
              image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop"
            - title: "Fireboy DML"
              desc: "Adedamola · R&B / Afro-Pop"
              image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop"
            - title: "Key Glock"
              desc: "Glockoma 2 · Memphis Trap"
              image: "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800&h=800&fit=crop"

      - type: story_banner
        variant: empire_story
        contract:
          bg: "#050505"
          text_color: "#FFFFFF"
        props:
          title: "THE FUTURE OF INDEPENDENT MUSIC."
          subtitle: "EMPIRE empowers creators with global DSP delivery, international sync administration, state-of-the-art recording facilities, and transparent real-time royalty reporting."
          highlights:
            - "100% Master Ownership & Creative Control"
            - "Direct DSP Distribution (Spotify, Apple, TikTok, YouTube)"
            - "International Sync Licensing & Publishing Admin"
            - "Real-time Royalty Tracking & Instant Mobile Payouts"
          image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=800&fit=crop"

      - type: action_strip
        variant: footer
        props:
          title: "JOIN THE EMPIRE NETWORK"
          subtitle: "Subscribe for release announcements, artist news, and sync opportunities."
          text: "© 2026 EMPIRE Distribution, Records & Publishing Inc. All rights reserved."
---
