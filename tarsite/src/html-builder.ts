/**
 * tarsite — Edge HTML Builder
 * Compiles Site Blueprint AST & style settings into Webflow-quality, 100% responsive HTML/CSS.
 * Stream responses directly from Cloudflare Edge in < 2ms.
 */

import { type UIRoute, type UINode, type DesignTokens } from './types';
import { compileCssVars } from './tokens';
import {
  renderAnnouncementBar,
  renderHeaderNav,
  renderHeroBanner,
  renderProductGrid,
  renderStoryBanner,
  renderFooterStrip,
} from './layout-blocks';

/**
 * Universal Node HTML Builder
 * Maps incoming nodes directly to the 6 Core Layout Blocks.
 */
export function renderNodeToHtml(node: UINode, tokens?: DesignTokens): string {
  switch (node.type) {
    // 1. Announcement Bar Block
    case 'announcement_bar':
    case 'marquee_strip':
    case 'promo_strip':
      return renderAnnouncementBar(node, tokens);

    // 2. Header Navigation Block
    case 'header_nav':
    case 'nav_header':
    case 'navigation_bar':
      return renderHeaderNav(node, tokens);

    // 3. Hero Banner Block
    case 'hero_banner':
    case 'media_hero':
    case 'hero_carousel':
    case 'section_hero':
      return renderHeroBanner(node, tokens);

    // 4. Product & Content Grid Block
    case 'product_grid':
    case 'content_grid':
    case 'lookbook_grid':
    case 'category_tiles':
    case 'perks_bar':
    case 'activity_discovery':
    case 'menu_grid':
    case 'service_list':
    case 'features_grid':
      return renderProductGrid(node, tokens);

    // 5. Story Split Banner Block
    case 'story_banner':
    case 'editorial_split':
      return renderStoryBanner(node, tokens);

    // 6. Action & Footer Strip Block
    case 'footer_strip':
    case 'action_strip':
    case 'contact_form':
    case 'footer':
      return renderFooterStrip(node, tokens);

    // Fallback to Product Grid for unmapped section types
    default:
      return renderProductGrid(node, tokens);
  }
}

/**
 * Compiles a complete UIRoute AST into a standalone, 100% responsive HTML page.
 */
export function compileRouteToHtml(route: UIRoute, tokens?: DesignTokens): string {
  const safeTokens = tokens || {
    name: 'Storefront',
    preset: 'custom',
    colors: { primary: '#18181B', secondary: '#475569', tertiary: '#D4AF37', background: '#FAFAFA', surface: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: 'rgba(0,0,0,0.08)' },
    typography: { fontHeading: 'Inter', fontBody: 'Inter', headingWeight: '700', bodyWeight: '400' },
    radii: { sm: '6px', md: '12px', lg: '16px', full: '9999px' },
    spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '48px' },
  };

  const cssVars = compileCssVars(safeTokens);
  const hasHeaderNode = route.nodes.some((n) => n.type === 'header_nav' || n.type === 'navigation_bar' || n.type === 'announcement_bar');
  const nodesHtml = route.nodes.map((node) => renderNodeToHtml(node, safeTokens)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${safeTokens.name || 'Storefront'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Marcellus&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${cssVars}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
    body {
      background-color: var(--color-background, #FAFAFA);
      color: var(--color-text, #0F172A);
      font-family: var(--font-body, 'Inter', sans-serif);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      width: 100%;
    }
    a { text-decoration: none; color: inherit; }
    img { max-width: 100%; height: auto; display: block; }
    button, input, textarea { font-family: inherit; }

    /* ── Responsive Container & Layout Rules ──────────────── */
    .container {
      width: 100%;
      max-width: 1340px;
      margin-left: auto;
      margin-right: auto;
      padding-left: clamp(16px, 4vw, 32px);
      padding-right: clamp(16px, 4vw, 32px);
    }

    /* ── Mobile Breakpoint (< 768px) ─────────────────────── */
    @media (max-width: 768px) {
      header {
        padding: 12px 16px !important;
        gap: 12px !important;
        flex-wrap: wrap !important;
      }
      header nav, header .nav-links {
        display: none !important;
      }
      header a[style*="font-size: 1.5rem"] {
        font-size: 1.25rem !important;
      }
      section[style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
        gap: 32px !important;
        padding: 40px 16px !important;
      }
      section[style*="height: 70vh"], section[style*="height: 75vh"] {
        height: auto !important;
        min-height: 420px !important;
        padding: 60px 16px 32px !important;
      }
      div[style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
        gap: 20px !important;
      }
      footer {
        padding: 40px 16px 24px !important;
      }
      footer div[style*="justify-content: space-between"] {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 20px !important;
      }
    }

    /* ── Tablet Breakpoint (769px - 1024px) ──────────────── */
    @media (min-width: 769px) and (max-width: 1024px) {
      header {
        padding: 14px 24px !important;
      }
      div[style*="grid-template-columns: repeat(auto-fit"] {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }
  </style>
</head>
<body>
  ${
    !hasHeaderNode
      ? `<header style="padding: 16px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100;">
          <a href="/" style="font-size: 1.25rem; font-family: var(--font-heading); font-weight: 700; color: var(--color-text); text-decoration: none; letter-spacing: 0.1em; text-transform: uppercase;">${safeTokens.name || 'STORE'}</a>
          <nav style="display: flex; gap: 20px; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;">
            <a href="/">Home</a>
            <a href="#products">Catalog</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>`
      : ''
  }

  <main>${nodesHtml}</main>
</body>
</html>`;
}
