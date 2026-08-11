/**
 * tarsite — Hardened Edge HTML Compiler (Phase 8 - OKF Universal Primitives Architecture)
 * 0-branch HTML compiler rendering UIPlan AST & OKF Section Contracts into Webflow-quality HTML/CSS.
 * Stream responses directly from Cloudflare Edge in < 5ms.
 */

import { type UIRoute, type UINode, type DesignTokens } from './types';
import { compileCssVars } from './tokens';
import {
  renderMarqueeStrip,
  renderNavigationBar,
  renderMediaHero,
  renderContentGrid,
  renderStoryBanner,
  renderActionStrip,
} from './primitives';

/**
 * Universal Node Renderer Router
 * Maps incoming nodes & section contracts directly to the 6 Universal Primitives.
 */
export function renderNodeToHtml(node: UINode, tokens?: DesignTokens): string {
  switch (node.type) {
    // 1. Marquee Strip Primitive
    case 'marquee_strip':
    case 'announcement_bar':
    case 'promo_strip':
      return renderMarqueeStrip(node, tokens);

    // 2. Navigation Bar Primitive
    case 'navigation_bar':
    case 'header_nav':
    case 'nav_header':
      return renderNavigationBar(node, tokens);

    // 3. Media Hero Primitive
    case 'media_hero':
    case 'hero_carousel':
    case 'section_hero':
    case 'hero_banner':
      return renderMediaHero(node, tokens);

    // 4. Content Grid Primitive
    case 'content_grid':
    case 'lookbook_grid':
    case 'category_tiles':
    case 'perks_bar':
    case 'activity_discovery':
    case 'product_grid':
    case 'menu_grid':
    case 'service_list':
    case 'features_grid':
      return renderContentGrid(node, tokens);

    // 5. Story Banner Primitive
    case 'story_banner':
    case 'editorial_split':
      return renderStoryBanner(node, tokens);

    // 6. Action Strip Primitive
    case 'action_strip':
    case 'contact_form':
    case 'footer':
      return renderActionStrip(node, tokens);

    // Fallback to Content Grid for unmapped custom section types
    default:
      return renderContentGrid(node, tokens);
  }
}

/**
 * Compiles a complete UIRoute AST into a standalone, ultra-performant HTML page.
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTokens.name || 'Storefront'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Marcellus&family=Montserrat:wght@400;500;600;700;800&family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${cssVars}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--color-background, #FAFAFA);
      color: var(--color-text, #0F172A);
      font-family: var(--font-body, 'Inter', sans-serif);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    a { text-decoration: none; color: inherit; }
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
