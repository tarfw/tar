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
    title: "EQL | Power Fair, High-Demand Product Drops & Launches"
    sections:
      - type: marquee_strip
        variant: launch_ticker
        contract:
          bg: "#0A0A0C"
          text_color: "#FFE600"
          font_size: "11px"
          letter_spacing: "0.22em"
          speed: "18s"
        props:
          text: "THIS LAUNCH IS RUN FAIR® · POWERING HIGH-DEMAND LAUNCHES · ZERO BOTS · CERTIFIED BOT-FREE PRODUCT DROPS · EQL LAUNCH PLATFORM"

      - type: navigation_bar
        variant: eql_header
        contract:
          sticky: true
          bg: "rgba(249, 249, 251, 0.94)"
          backdrop_blur: "20px"
          logo_position: "left"
          cta_bg: "#FFF6C7"
          cta_text: "#0A0A0C"
          cta_shape: "pill"
        props:
          brand_name: "EQL"
          nav_links:
            - label: "For Brands"
              url: "/brands-home"
            - label: "For Fans"
              url: "/fans/for-fans"
            - label: "Run Fair®"
              url: "/runfair"
            - label: "Case Studies"
              url: "/partner-stories"
            - label: "Pricing"
              url: "/pricing"
          cta_label: "CONTACT SALES"

      - type: media_hero
        variant: launch_hero
        contract:
          layout_mode: "split"
          height: "80vh"
          cta_bg: "#0A0A0C"
          cta_text: "#FFFFFF"
        props:
          badge: "TRUSTED BY THE WORLD'S MOST INNOVATIVE BRANDS: NIKE · TOPPS · LAPHROAIG · UNDEFEATED"
          headline: "Fueling fandom and growth with every launch."
          subtitle: "EQL helps brands run secure, bot-free, fair launches for high-demand sneakers, trading cards, rare spirits & hype collectibles."
          ctaText: "Explore EQL for Brands"
          secondaryCtaText: "Explore EQL for Fans ›"
          image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d0b66370c6cdcd9a8d54_air-jordan_converted.avif"

      - type: content_grid
        variant: eql_audience_cards
        contract:
          columns: 2
          gap: "24px"
          aspect_ratio: "16/10"
          hover_zoom: 1.03
          card_bg: "#FFF6C7"
          card_border: "1px solid rgba(10,10,12,0.1)"
          card_radius: "16px"
        props:
          title: "BUILT FOR PASSION & LAUNCHED WITH INTENTION"
          subtitle: "Everything you need to capture demand, control the chaos, and maximize the launch moment."
          items:
            - title: "For Brands & Retailers"
              badge: "LAUNCH WITH INTENTION"
              description: "Everything you need to capture demand, control the chaos, and maximize the launch moment. Infinitely reliable and simple to integrate."
              ctaText: "Explore EQL for Brands"
              image: "https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/6a1d93dca972c2c65b4f2301_Screenshot%202025-06-17%20at%2011.31.31%202.avif"
            - title: "For Fans & Collectors"
              badge: "BUILT FOR PASSION"
              description: "Launches by EQL are Run Fair® which means no bots, less frustration, and a better experience for fans who care the most."
              ctaText: "Explore EQL for Fans"
              image: "https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/6a1d94219359c08726c25a77_Frame%201948754835.avif"

      - type: content_grid
        variant: eql_drops
        contract:
          columns: 4
          gap: "20px"
          aspect_ratio: "4/3"
          hover_zoom: 1.06
          card_bg: "#FFFFFF"
          card_border: "1px solid rgba(10,10,12,0.1)"
          card_radius: "12px"
        props:
          title: "RECENT HIGH-HEAT DROPS LAUNCHED ON EQL"
          subtitle: "Discover limited releases verified bot-free with Run Fair® certification."
          items:
            - title: "BE@RBRICK Kasing Lung"
              description: "Launched by 3D RETRO — High-Demand Art Toy Drop."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d7cc8009e1ad96cb4ae5_bear-small.avif"
            - title: "Air Jordan 1 High OG"
              description: "Launched by Virgil Abloh Archive — Certified Bot-Free Drop."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d0b66370c6cdcd9a8d54_air-jordan_converted.avif"
            - title: "Topps x Fanatics Fest F1"
              description: "Launched by FFNYC — Limited Formula 1 Trading Card Box."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71dd924d114675ed54a3b3_6a2b09b1cb9c58cc3570d68d_Group%202538_converted.avif"
            - title: "New Balance 1890 Cut The Check"
              description: "Launched by Joe Freshgoods — Exclusive Footwear Release."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71db1e3fceabbecf9ec678_JFG%20x%20New%20Balance%201890%20Cut%20The%20Check%20Green%20(1)%201_converted.avif"
            - title: "Brain Rot Art Edition"
              description: "Launched by PIGGYBANX — Limited Hype Art Collectible."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d9fa3691e17e84b4b4b7_brainrot_converted.avif"
            - title: "Pokémon Small Pikachu"
              description: "Launched by Tiffany & Co. — Fine Jewelry & Collectible Drop."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d937e28bfebefe886136_Tiffany_small.avif"
            - title: "Air Jordan 4 Retro Deep Green"
              description: "Launched by UNDEFEATED — Hype Sneaker Release."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a71d9933fceabbecf9d9e32_air-jordan-4-x-undefeated-deep-green-and-clementine-ib1519-200-release-date-1%201_converted.avif"
            - title: "2025 Topps Chrome Veefriends"
              description: "Launched by Topps — Sealed Hobby Box Release."
              image: "https://cdn.prod.website-files.com/68b5b38c72e3211ecab9306f/6a3beefbdd3dca49510b7517_topps-chrome.avif"

      - type: content_grid
        variant: eql_metrics
        contract:
          columns: 4
          gap: "20px"
          aspect_ratio: "16/9"
          hover_zoom: 1.02
          card_bg: "#FFFFFF"
          card_border: "1px solid rgba(10,10,12,0.1)"
          card_radius: "16px"
        props:
          title: "PROVEN IMPACT ACROSS 14,000+ LAUNCHES"
          subtitle: "The world's leading platform for bot protection and fair product releases."
          items:
            - title: "14K+ Launches"
              description: "Hundreds of brands trust EQL with their biggest releases."
            - title: "2M+ Bots Blocked"
              description: "EQL is the world's leading platform for bot protection on high-heat launches."
            - title: "100% Uptime"
              description: "Indestructible reliability during massive hype traffic spikes."
            - title: "95% Fan Trust"
              description: "Fans surveyed said when they see a launch is 'Run Fair® through EQL' they know they have a real shot."

      - type: story_banner
        variant: eql_nike_quote
        contract:
          bg: "#FFF6C7"
          text_color: "#0A0A0C"
        props:
          title: "PARTNERING WITH THE WORLD'S GREATEST BRANDS"
          subtitle: '"The DNA of Nike is built on innovation, so partnering with EQL just makes sense. The EQL team is leading the way when it comes to innovation in launch and fairness, and we couldn’t be happier with the partnership across the Pacific marketplace."'
          highlights:
            - "Ashley Reade, VP, Nike Pacific"
            - "Official Launch Partner across Sneakers, Apparel & Exclusives"
            - "Bot-Free Entry Verification for High-Heat Drops"
            - "Seamless Integration with Enterprise Commerce Workflows"
          image: "https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/6a1d73eefd89c9607da62789_nike.avif"

      - type: story_banner
        variant: eql_runfair_stamp
        contract:
          bg: "#0A0A0C"
          text_color: "#FFFFFF"
        props:
          title: "MEET THE STAMP THAT MATTERS: CERTIFIED RUN FAIR®"
          subtitle: "Both brands and fans can be confident that each launch is rewarding the rule followers, filtering out the bad actors, and offering an experience that is both secure and smooth as butter."
          highlights:
            - "99.8% Bot & Automated Script Mitigation Accuracy"
            - "Transparent Winner Draw & Instant Payment Capture"
            - "Multi-Entry & Duplicate Account Fraud Detection"
            - "Verified Official Partner Badge for Retail Drops"
          image: "https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/6a2168dd502622b9a2e75faf_nike_runners_smiling_outdoors.avif"

      - type: action_strip
        variant: eql_footer_action
        props:
          title: "READY TO POWER YOUR NEXT HIGH-DEMAND LAUNCH?"
          subtitle: "Schedule a strategy session with our product release specialists."
          text: "© 2026 EQL Commerce Inc. All rights reserved. Run Fair® is a registered trademark of EQL."
---
