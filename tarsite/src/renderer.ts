/**
 * tarsite — Hardened Edge HTML Compiler (Phase 8)
 * Single runtime HTML compiler rendering UIPlan AST & DesignTokens into Webflow-quality HTML/CSS.
 * Stream responses directly from Cloudflare Edge in < 5ms.
 */

import { type UIRoute, type UINode, type DesignTokens } from './types';
import { compileCssVars } from './tokens';

export function renderNodeToHtml(node: UINode): string {
  const p = node.props || {};

  switch (node.type) {
    case 'announcement_bar':
      return `
        <div style="background:var(--color-primary); color:white; text-align:center; padding:var(--space-xs) var(--space-md); font-size:0.85rem; font-weight:500;">
          ${p.text || p.title || p.headline || 'Notification announcement'}
        </div>
      `;

    case 'header_nav':
      return `
        <div style="padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--color-border); background: var(--color-surface); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.2rem; font-family: var(--font-heading); color: var(--color-text);">${p.title || p.headline || p.name || 'Storefront'}</h2>
          <span style="font-size: 0.85rem; color: var(--color-muted);">${p.subtitle || 'Official Store'}</span>
        </div>
      `;

    case 'hero_banner':
      return `
        <section style="padding: calc(var(--space-xl) * 1.2) var(--space-lg); text-align: ${node.layout === 'split' ? 'left' : 'center'}; max-width: 1100px; margin: 0 auto;">
          ${p.badge ? `<span style="display:inline-block; padding: 4px 12px; background: rgba(0,0,0,0.04); border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-sm); color: var(--color-primary);">${p.badge}</span>` : ''}
          <h1 style="font-size: clamp(2.2rem, 5vw, 3.8rem); font-family: var(--font-heading); font-weight: var(--font-weight-heading); color: var(--color-text); line-height: 1.1; margin-bottom: var(--space-md);">${p.headline || p.title || p.name || 'Elevate Your Storefront'}</h1>
          <p style="font-size: 1.15rem; color: var(--color-muted); max-width: 650px; ${node.layout === 'split' ? '' : 'margin: 0 auto;'} margin-bottom: var(--space-lg); line-height: 1.6;">${p.subtitle || p.description || p.text || 'Engineered for exceptional performance and modern design standards.'}</p>
          <div style="display: flex; gap: var(--space-md); ${node.layout === 'split' ? '' : 'justify-content: center;'} flex-wrap: wrap;">
            ${p.ctaText ? `<a href="${p.ctaUrl || '#products'}" class="btn-primary" style="background:var(--color-primary); color:white; padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-md); text-decoration: none; font-weight: 600; display: inline-block;">${p.ctaText}</a>` : '<a href="#products" class="btn-primary" style="background:var(--color-primary); color:white; padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-md); text-decoration: none; font-weight: 600; display: inline-block;">Explore Collection</a>'}
            ${p.secondaryCtaText ? `<a href="${p.secondaryCtaUrl || '#contact'}" class="btn-secondary" style="border: 1px solid var(--color-border); color:var(--color-text); padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-md); text-decoration: none; font-weight: 600; display: inline-block;">${p.secondaryCtaText}</a>` : ''}
          </div>
        </section>
      `;

    case 'category_tiles':
    case 'perks_bar':
    case 'activity_discovery':
      const tiles = Array.isArray(p.items) ? p.items : [];
      const tilesHtml = tiles
        .map(
          (t: any) => `
        <div style="background: var(--color-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center;">
          <h4 style="font-size: 1.05rem; font-family: var(--font-heading); margin-bottom: 4px; color: var(--color-text);">${t.title || t.name || 'Category'}</h4>
          <p style="color: var(--color-muted); font-size: 0.85rem;">${t.description || t.subtitle || ''}</p>
        </div>
      `
        )
        .join('');
      return `
        <section style="padding: var(--space-lg); max-width: 1100px; margin: 0 auto;">
          ${p.title || p.headline ? `<h2 style="font-size: 1.6rem; font-family: var(--font-heading); text-align: center; margin-bottom: var(--space-md); color: var(--color-text);">${p.title || p.headline}</h2>` : ''}
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-md);">
            ${tilesHtml || '<div style="background: var(--color-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center;"><h4 style="font-size: 1rem; color: var(--color-text);">Featured Category</h4></div>'}
          </div>
        </section>
      `;

    case 'editorial_split':
      return `
        <section style="padding: var(--space-xl) var(--space-lg); max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-xl); align-items: center;">
          <div>
            <h2 style="font-size: 2rem; font-family: var(--font-heading); margin-bottom: var(--space-md); color: var(--color-text);">${p.title || p.headline || 'Our Story'}</h2>
            <p style="color: var(--color-muted); font-size: 1.05rem; line-height: 1.6;">${p.subtitle || p.text || p.description || 'Crafted with precision, quality materials, and unwavering commitment.'}</p>
          </div>
          <div style="background: var(--color-surface); height: 260px; border-radius: var(--radius-md); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; color: var(--color-muted);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        </section>
      `;

    case 'product_grid':
    case 'menu_grid':
    case 'service_list':
      const items = Array.isArray(p.items) ? p.items : [];
      const cardsHtml = items
        .map(
          (item: any) => `
        <div style="background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border); overflow: hidden; display: flex; flex-direction: column;">
          <div style="height: 180px; background: rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: center; color: var(--color-muted);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div style="padding: var(--space-md); display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
            <div>
              <h3 style="font-size: 1.1rem; font-family: var(--font-heading); margin-bottom: 4px; color: var(--color-text);">${item.name || item.title || 'Product Item'}</h3>
              <p style="color: var(--color-muted); font-size: 0.88rem; margin-bottom: var(--space-sm); line-height: 1.4;">${item.description || item.subtitle || ''}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-sm);">
              <span style="font-weight: 700; color: var(--color-primary); font-size: 1.05rem;">₹${item.price != null ? item.price : item.value || 0}</span>
              <button class="add-cart-btn" data-name="${item.name || item.title}" data-price="${item.price || item.value || 0}" style="background: var(--color-primary); color: white; border: none; padding: 6px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; cursor: pointer;">Add to Cart</button>
            </div>
          </div>
        </div>
      `
        )
        .join('');

      return `
        <section id="products" style="padding: var(--space-xl) var(--space-lg); max-width: 1200px; margin: 0 auto;">
          ${p.title || p.headline ? `<h2 style="font-size: 1.8rem; font-family: var(--font-heading); text-align: center; margin-bottom: 4px; color: var(--color-text);">${p.title || p.headline}</h2>` : ''}
          ${p.subtitle ? `<p style="text-align: center; color: var(--color-muted); margin-bottom: var(--space-lg);">${p.subtitle}</p>` : ''}
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-lg);">
            ${cardsHtml || '<p style="text-align:center; grid-column: 1/-1; color: var(--color-muted);">No catalog items available.</p>'}
          </div>
        </section>
      `;

    case 'testimonials':
      const quotes = Array.isArray(p.items) ? p.items : [];
      const testHtml = quotes
        .map(
          (q: any) => `
        <div style="background: var(--color-surface); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <p style="font-style: italic; color: var(--color-text); margin-bottom: var(--space-sm); font-size: 0.95rem; line-height: 1.5;">"${q.quote || q.text || q.description || 'Exceptional experience.'}"</p>
          <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-primary);">${q.author || q.name || 'Client'}</div>
          ${q.role ? `<div style="font-size: 0.75rem; color: var(--color-muted);">${q.role}</div>` : ''}
        </div>
      `
        )
        .join('');

      return `
        <section style="padding: var(--space-xl) var(--space-lg); max-width: 1000px; margin: 0 auto;">
          ${p.title || p.headline ? `<h2 style="font-size: 1.8rem; font-family: var(--font-heading); text-align: center; margin-bottom: var(--space-lg); color: var(--color-text);">${p.title || p.headline}</h2>` : ''}
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md);">
            ${testHtml}
          </div>
        </section>
      `;

    case 'contact_form':
      return `
        <section id="contact" style="padding: var(--space-xl) var(--space-lg); max-width: 550px; margin: 0 auto;">
          <div style="background: var(--color-surface); padding: var(--space-lg); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <h2 style="font-size: 1.5rem; font-family: var(--font-heading); margin-bottom: 4px; color: var(--color-text); text-align: center;">${p.title || p.headline || 'Get In Touch'}</h2>
            ${p.subtitle ? `<p style="text-align: center; color: var(--color-muted); font-size: 0.9rem; margin-bottom: var(--space-md);">${p.subtitle}</p>` : ''}
            <form id="public-contact-form" style="display: flex; flex-direction: column; gap: var(--space-md);">
              <input type="text" id="contact-name" placeholder="Your Name" required style="padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-family: inherit; font-size: 0.9rem;" />
              <input type="text" id="contact-info" placeholder="Email or Phone" required style="padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-family: inherit; font-size: 0.9rem;" />
              <textarea id="contact-message" placeholder="How can we help?" rows="4" required style="padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); border: 1px solid var(--color-border); font-family: inherit; font-size: 0.9rem;"></textarea>
              <button type="submit" style="background: var(--color-primary); color: white; border: none; padding: 12px; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; font-size: 0.95rem;">${p.submitLabel || 'Send Message'}</button>
            </form>
          </div>
        </section>
      `;

    case 'footer':
      return `
        <footer style="padding: var(--space-lg); border-top: 1px solid var(--color-border); text-align: center; font-size: 0.85rem; color: var(--color-muted); margin-top: var(--space-xl);">
          <p>${p.text || p.title || '© All rights reserved.'}</p>
        </footer>
      `;

    default:
      return `<div style="padding: var(--space-md); border: 1px dashed var(--color-border); text-align: center; color: var(--color-muted); font-size: 0.85rem;">Section [${node.type}]</div>`;
  }
}

export function compileRouteToHtml(route: UIRoute, tokens: DesignTokens): string {
  const cssVars = compileCssVars(tokens);
  const nodesHtml = route.nodes.map(renderNodeToHtml).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tokens.name || 'TAR Storefront'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>
    ${cssVars}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--color-background);
      color: var(--color-text);
      font-family: var(--font-body);
      font-weight: var(--font-weight-body);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--color-border);
      background: var(--color-surface); position: sticky; top: 0; z-index: 50;
    }
    nav a { text-decoration: none; color: var(--color-text); font-weight: 500; margin-left: var(--space-md); font-size: 0.9rem; }
    nav a:hover { color: var(--color-primary); }
  </style>
</head>
<body>
  <header>
    <a href="/" style="font-size: 1.25rem; font-family: var(--font-heading); font-weight: var(--font-weight-heading); color: var(--color-text); text-decoration: none;">${tokens.name}</a>
    <nav>
      <a href="/">Home</a>
      <a href="/catalog">Catalog</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main>${nodesHtml}</main>

  <script>
    const form = document.getElementById('public-contact-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('contact-name').value,
          info: document.getElementById('contact-info').value,
          message: document.getElementById('contact-message').value
        };
        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            alert('Thank you for contacting us!');
            form.reset();
          }
        } catch {}
      });
    }
  </script>
</body>
</html>`;
}
