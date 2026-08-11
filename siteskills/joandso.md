---
preset_name: JO&SO Boutique Hotel Guide
template: joandso

tokens:
  color_bg: "#FAF7F2"
  color_surface: "#FFFFFF"
  color_primary: "#2C2523"
  color_secondary: "#B57D14"
  color_accent: "#173577"
  color_text: "#2C2523"
  color_muted: "rgba(44, 37, 35, 0.65)"
  color_border: "rgba(44, 37, 35, 0.12)"
  font_heading: "Playfair Display"
  font_body: "Inter"

routes:
  "/":
    title: "JO&SO | Cool Boutique Hotels in Portugal Handpicked by Two Sisters"
    sections:
      - type: marquee_strip
        variant: warm_ticker
        contract:
          bg: "#2C2523"
          text_color: "#FAF7F2"
          font_size: "11px"
          letter_spacing: "0.2em"
          speed: "20s"
        props:
          text: "JO&SO INSIDER GUIDE · HANDPICKED BOUTIQUE HOTELS IN PORTUGAL · LISBON · PORTO · ALGARVE · COMPORTA · AZORES"

      - type: navigation_bar
        variant: joandso_header
        contract:
          sticky: true
          bg: "rgba(250, 247, 242, 0.94)"
          backdrop_blur: "20px"
          logo_position: "center"
          cta_bg: "#2C2523"
          cta_text: "#FAF7F2"
          cta_shape: "pill"
        props:
          brand_name: "JO & SO"
          nav_links:
            - label: "Hotels"
              url: "#regions"
            - label: "Homes"
              url: "#destinations"
            - label: "Journal"
              url: "#story"
            - label: "About"
              url: "#story"
          cta_label: "Search Stays"

      - type: media_hero
        variant: warm_editorial
        contract:
          layout_mode: "split"
          height: "75vh"
          cta_bg: "#2C2523"
          cta_text: "#FFFFFF"
        props:
          badge: "INSIDER PORTUGAL HOTEL GUIDE"
          headline: "The cool hotels in Portugal handpicked by two Portuguese sisters."
          subtitle: "Discover curated boutique stays, rural farmhouses, and design hideaways across Lisbon, Porto, Algarve, Comporta & beyond."
          ctaText: "Explore All 106 Hotels ›"
          secondaryCtaText: "Browse By Region"
          image: "https://cdn.prod.website-files.com/5fecc80e92fcdb7da9d1f0fb/6808ba6ad259ea809f952558_joandso-cool-hotels-portugal-joana-sofia-1600.webp"

      - type: content_grid
        variant: joandso_regions
        contract:
          columns: 4
          gap: "20px"
          aspect_ratio: "4/3"
          hover_zoom: 1.05
          card_bg: "#FFFFFF"
          card_border: "1px solid rgba(44,37,35,0.08)"
          card_radius: "12px"
        props:
          title: "Boutique Hotels in Portugal by Region"
          subtitle: "Explore our personal recommendations for the best stays across Portugal's unique landscapes."
          items:
            - title: "Boutique Hotels in Lisbon"
              desc: "Romantic cobblestone lanes, lively café culture & rooftop views."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69174e50e9b4bef98179440e_%20best-boutique-hotels-lisbon-memmo-principe-real-breakfast-joandso.webp"
            - title: "Boutique Hotels in Porto"
              desc: "Historic riverfront hills, Port wine cellars & Douro views."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6917508d01e2302dbc08c3e8_%20best-boutique-hotels-porto-historic-steps-douro-river-joandso.webp"
            - title: "Boutique Hotels in Algarve"
              desc: "Golden limestone cliffs, turquoise coves & fruit tree orchards."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6917543f92053ca1b679da4a_best-boutique-hotels-algarve-golden-cliffs-beach-joandso.webp"
            - title: "Boutique Hotels in Alentejo"
              desc: "Whitewashed sleepy villages, cork groves & wild empty beaches."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175654e5ca87493373e9c4_best-boutique-hotels-alentejo-horseback-riding-countryside-joandso.webp"
            - title: "Boutique Hotels in North Portugal"
              desc: "Terraced Douro vineyards, wine estates & green mountain valleys."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/6a6b5e5cfe3c73cdb5fdb56e_vidago-palace-hotel-best-hotels-north-portugal-joandso.webp"
            - title: "Boutique Hotels in Central Portugal"
              desc: "Schist stone villages, Serra da Estrela peaks & Silver Coast waves."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175a522d7d4504933c2646_central-portugal-schist-architecture-mountain-landscape-boutique-hotels-joandso.webp"
            - title: "Boutique Hotels in Azores"
              desc: "Twin volcanic crater lakes, hot springs & lush island botanicals."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/691749afc3d7b13e951c4796_best-boutique-hotels-azores-sete-cidades.webp"
            - title: "Boutique Hotels in Madeira"
              desc: "Dramatic Atlantic cliff estates, subtropical gardens & ocean views."
              image: "https://cdn.prod.website-files.com/6005cd6988e875868452d33d/69175d7ff508ae2f05113071_best-boutique-hotels-madeira-reids-palace-funchal-volcanic-cliffs.webp"

      - type: story_banner
        variant: joandso_sisters
        contract:
          bg: "#FAF7F2"
          text_color: "#2C2523"
        props:
          title: "CURATED WITH LOVE BY TWO PORTUGUESE SISTERS"
          subtitle: "Hi, we are Joana and Sofia Lacerda. We personally visit and review every single boutique hotel, guesthouse, and secret stay on JO&SO so you get honest, insider recommendations."
          highlights:
            - "100% Personally Vetted & Tested Portugal Stays"
            - "No Paid Advertising or Sponsored Placements"
            - "Direct Booking Links & Exclusive Sister Perks"
            - "Authors of 'The 500 Hidden Secrets of Porto'"
          image: "https://cdn.prod.website-files.com/5fecc80e92fcdb7da9d1f0fb/66c31e9973b741e8535c61a2_joandso-cool-hotels-portugal-joana-sofia.webp"

      - type: action_strip
        variant: warm_newsletter
        props:
          title: "GET OUR INSIDER PORTUGAL HOTEL GUIDE"
          subtitle: "Join 45,000+ travelers receiving our monthly secret stays and boutique hotel drops."
          text: "© 2026 JO&SO Collection Inc. Handpicked boutique stays in Portugal."
---
