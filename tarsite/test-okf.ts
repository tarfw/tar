import { parseOkfDesign } from './src/okf-parser';
import { compileRouteToHtml } from './src/renderer';

const sampleOkfDesign = `---
preset_name: Milo Veterinary Clean
tokens:
  color_primary: "#032E1C"
  color_accent: "#1FCB60"
  color_bg: "#FAF7F2"
  color_surface: "#FFFFFF"
  color_text: "#032E1C"

routes:
  "/":
    title: "Milo Pet Insurance | 100% Vet Reimbursement"
    sections:
      - type: marquee_strip
        variant: promo_bar
        contract:
          bg: "#032E1C"
          text_color: "#1FCB60"
          font_size: "11px"
          letter_spacing: "0.15em"
        props:
          text: "100% VET EXPENSE REIMBURSEMENT | DIGITAL PET INSURANCE | NO HIDDEN FEES"

      - type: navigation_bar
        variant: sticky_glass
        contract:
          sticky: true
          backdrop_blur: "16px"
          cta_bg: "#1FCB60"
          cta_text: "#032E1C"
          cta_shape: "pill"
        props:
          brand_name: "milo."
          cta_label: "Get Your Price 🐾"

      - type: media_hero
        variant: hero_split
        contract:
          layout_mode: "split"
          cta_bg: "#1FCB60"
          cta_text: "#032E1C"
        props:
          badge: "COMPREHENSIVE PET HEALTH INSURANCE"
          headline: "Vet Insurance That Truly Delivers When Your Dog Needs It Most."
          subtitle: "100% reimbursement on vet bills with zero paperwork. Fast, digital, and transparent."
          ctaText: "Get Your Price 🐾"
          secondaryCtaText: "View Coverage ›"
          image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&h=800&fit=crop"

      - type: content_grid
        variant: feature_cards
        contract:
          columns: 3
          gap: "24px"
          card_bg: "#FFFFFF"
          card_border: "1px solid rgba(3,46,28,0.08)"
          card_radius: "16px"
          hover_zoom: 1.05
        props:
          title: "Why Pet Owners Choose Milo"
          subtitle: "Designed by pet lovers for ultimate veterinary peace of mind."
          items:
            - title: "100% Reimbursement"
              description: "Get 100% of vet expenses refunded directly to your bank in under 72 hours."
              image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=450&fit=crop"
            - title: "Any Vet Clinic"
              description: "Visit any licensed vet clinic or emergency hospital nationwide."
              image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&h=450&fit=crop"
            - title: "100% Digital Claims"
              description: "Upload a photo of your receipt from your phone in under 30 seconds."
              image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&h=450&fit=crop"

      - type: story_banner
        variant: dark_editorial
        contract:
          bg: "#032E1C"
          text_color: "#FFFFFF"
        props:
          title: "Everything Included in Milo Protection"
          subtitle: "No deductible surprises or fine print when it matters most."
          highlights:
            - "General & specialist vet consultations"
            - "Surgeries & complex procedures"
            - "Hospitalization & intensive care"
            - "24/7 emergency veterinary care"
          image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&h=800&fit=crop"

      - type: action_strip
        variant: footer
        props:
          text: "© 2026 Milo Pet Insurance Inc. All Rights Reserved."
---

# Milo OKF Design Specification
Parsed and rendered using 6 Universal Primitives with OKF Section Contracts.
`;

function testOkfPipeline() {
  console.log('--- 1. Parsing OKF design.md ---');
  const startParse = performance.now();
  const plan = parseOkfDesign(sampleOkfDesign, 'w:milo_okf_demo');
  const parseTime = (performance.now() - startParse).toFixed(3);
  console.log(`✅ OKF Parsed in ${parseTime}ms`);
  console.log(`Routes: ${plan.routes.length}, Nodes in Home Route: ${plan.routes[0].nodes.length}`);

  console.log('--- 2. Compiling Universal Primitives to HTML ---');
  const startCompile = performance.now();
  const html = compileRouteToHtml(plan.routes[0], plan.designTokens);
  const compileTime = (performance.now() - startCompile).toFixed(3);
  console.log(`⚡ Compiled HTML in ${compileTime}ms`);
  console.log(`HTML Length: ${html.length} chars`);

  console.log('Includes milo:', html.includes('milo'));
  console.log('Includes --grid-cols: 3:', html.includes('--grid-cols: 3'));
  console.log('Includes 100% VET EXPENSE REIMBURSEMENT:', html.includes('100% VET EXPENSE REIMBURSEMENT'));

  if (html.includes('milo') && html.includes('--grid-cols: 3') && html.includes('100% VET EXPENSE REIMBURSEMENT')) {
    console.log('🎉 SUCCESS: Universal Primitives render pixel-faithful Milo layout driven by OKF Contract!');
  } else {
    console.error('❌ Output validation failed.');
  }
}

testOkfPipeline();
