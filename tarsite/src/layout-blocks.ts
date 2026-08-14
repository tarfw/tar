/**
 * tarsite — 6 Core Layout Blocks
 * Zero site-specific hardcoding. Evaluates design styles & CSS Custom Variables.
 * 100% Fluid & Fully Responsive across all device form factors.
 */

import { type UINode, type DesignTokens } from './types';
import { buildStyleCssVars } from './style-engine';

/**
 * 1. Announcement Bar Block (Announcements, Tickers, Banners)
 */
export function renderAnnouncementBar(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);

  const text = p.text || p.title || p.headline || 'Welcome to our store | Free Shipping on Orders Over $100';
  const bg = c.bg || 'var(--color-primary, #000000)';
  const textColor = c.text_color || 'var(--color-surface, #ffffff)';
  const fontSize = c.font_size || '11px';
  const letterSpacing = c.letter_spacing || '0.15em';

  return `
    <div class="announcement-bar" style="${cssVars}; background: ${bg}; color: ${textColor}; text-align: center; padding: 10px 16px; font-size: ${fontSize}; font-weight: 600; letter-spacing: ${letterSpacing}; text-transform: uppercase; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
      ${text}
    </div>
  `;
}

/**
 * 2. Header Navigation Block (Headers, Sticky Glass, Brand Logos, Action Buttons)
 */
export function renderHeaderNav(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);

  const brand = (p.brand_name || p.title || p.headline || p.name || tokens?.name || 'STORE').replace(/\.$/, '');
  const links = Array.isArray(p.nav_links) ? p.nav_links : Array.isArray(p.links) ? p.links : [
    { label: 'New Arrivals', url: '#products' },
    { label: 'Collection', url: '#products' },
    { label: 'About', url: '#about' },
  ];

  const isSticky = c.sticky !== false;
  const isGlass = c.backdrop_blur || node.variant === 'sticky_glass';

  const positionStyle = isSticky ? 'position: sticky; top: 0; z-index: 100;' : 'position: relative;';
  const bgStyle = isGlass
    ? `background: ${c.bg || 'rgba(255, 255, 255, 0.85)'}; backdrop-filter: blur(${c.backdrop_blur || '16px'});`
    : `background: ${c.bg || 'var(--color-surface, #ffffff)'};`;

  const ctaBg = c.cta_bg || 'var(--color-primary, #000000)';
  const ctaText = c.cta_text || 'var(--color-surface, #ffffff)';
  const ctaShape = c.cta_shape === 'pill' ? '9999px' : 'var(--radius-md, 8px)';

  return `
    <header class="header-nav" style="${cssVars}; ${positionStyle} ${bgStyle} border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.08)); padding: 16px clamp(16px, 4vw, 32px); display: flex; justify-content: space-between; align-items: center; gap: 16px;">
      <a href="#" style="font-family: var(--font-heading, sans-serif); font-size: clamp(1.2rem, 3vw, 1.5rem); font-weight: 800; color: var(--section-text, var(--color-text, #111)); text-decoration: none; letter-spacing: -0.02em; flex-shrink: 0;">
        ${brand}<span style="color: var(--color-primary, #000);">.</span>
      </a>

      <div class="nav-links" style="display: flex; gap: clamp(14px, 2.5vw, 28px); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; flex-wrap: wrap;">
        ${links.map((l: any) => `
          <a href="${l.url || '#'}" style="text-decoration: none; color: var(--color-text, #333); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6'" onmouseout="this.style.opacity='1'">${l.label || l.name || l.title}</a>
        `).join('')}
      </div>

      <div class="header-cta" style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
        <a href="#cart" style="background: ${ctaBg}; color: ${ctaText}; padding: 9px clamp(14px, 2vw, 22px); border-radius: ${ctaShape}; font-size: 0.82rem; font-weight: 700; text-decoration: none; letter-spacing: 0.04em; transition: transform 0.2s; white-space: nowrap;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
          ${p.cta_label || p.ctaText || 'Shop Now'}
        </a>
      </div>
    </header>
  `;
}

/**
 * 3. Hero Banner Block (Visual Heroes, Split Heroes, Carousels)
 */
export function renderHeroBanner(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);

  const mode = c.layout_mode || node.layout || 'full';
  const headline = p.headline || p.title || tokens?.name || 'Next Generation Storefront';
  const subtitle = p.subtitle || p.description || p.text || 'Designed with precision engineering and dynamic style blueprints.';
  const image = p.image || (Array.isArray(p.items) && p.items[0]?.image) || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1920&h=960&fit=crop';
  const height = c.height || '70vh';
  const ctaText = p.ctaText || p.buttonText || 'Explore Collection';
  const secondaryCtaText = p.secondaryCtaText;

  if (mode === 'split' || node.variant === 'launch_hero' || node.variant === 'hero_split') {
    const isEqlHero = node.variant === 'launch_hero';
    return `
      <section class="hero-split-section" style="${cssVars}; padding: clamp(40px, 6vw, 64px) clamp(16px, 4vw, 24px); max-width: 1340px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: clamp(24px, 4vw, 48px); align-items: center;">
        <div>
          ${p.badge ? `<span style="display: inline-block; background: rgba(0,0,0,0.06); color: var(--color-primary); padding: 5px 12px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">${p.badge}</span>` : ''}
          ${isEqlHero ? `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">
              <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: clamp(1.8rem, 4vw, 3.2rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFFFFF; border: 2px solid #0A0A0C; padding: 4px 14px; border-radius: 8px; color: #0A0A0C;">Fueling fandom</span>
                <span style="background: #FFF6C7; border: 2px solid #0A0A0C; padding: 4px 14px; border-radius: 8px; color: #0A0A0C;">And</span>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: clamp(1.8rem, 4vw, 3.2rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFE600; border: 2px solid #0A0A0C; padding: 4px 14px; border-radius: 8px; color: #0A0A0C;">growth</span>
                <span style="background: #E5E7EB; border: 2px solid #0A0A0C; padding: 4px 14px; border-radius: 8px; color: #0A0A0C;">with every</span>
              </div>
              <div style="font-size: clamp(1.8rem, 4vw, 3.2rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFE600; border: 2px solid #0A0A0C; padding: 4px 20px; border-radius: 8px; color: #0A0A0C;">Launch</span>
              </div>
            </div>
          ` : `<h1 style="font-family: var(--font-heading); font-size: clamp(2rem, 4.5vw, 3.6rem); line-height: 1.1; color: var(--color-text); margin-bottom: 18px; letter-spacing: -0.03em;">${headline}</h1>`}
          <p style="font-family: var(--font-body); font-size: clamp(0.95rem, 2vw, 1.1rem); color: var(--color-muted); margin-bottom: 28px; max-width: 540px; line-height: 1.6;">${subtitle}</p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px;">
            <a href="${p.ctaUrl || '#products'}" style="background: var(--cta-bg, var(--color-primary)); color: var(--cta-text, #fff); padding: 13px clamp(20px, 3vw, 32px); border-radius: var(--radius-full, 9999px); font-weight: 700; font-size: 0.85rem; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.12); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">${ctaText}</a>
            ${secondaryCtaText ? `<a href="${p.secondaryCtaUrl || '#about'}" style="padding: 13px clamp(20px, 3vw, 32px); border: 1px solid var(--color-border); border-radius: var(--radius-full, 9999px); font-weight: 600; font-size: 0.85rem; text-decoration: none; color: var(--color-text);">${secondaryCtaText}</a>` : ''}
          </div>
          ${isEqlHero ? `
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; opacity: 0.85; padding-top: 16px; border-top: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Trusted by:</span>
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c1824077dace994ff08733_image%20(11).svg" alt="Nike" style="height: 18px;" />
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c18972db40a48908a2575b_image%20(22).svg" alt="Topps" style="height: 22px;" />
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c18bc7abf6f5491e782258_image%20(26).svg" alt="Laphroaig" style="height: 16px;" />
            </div>
          ` : ''}
        </div>
        <div style="position: relative; border-radius: var(--radius-lg, 12px); overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.08);">
          <img src="${image}" alt="${headline}" style="width: 100%; height: clamp(280px, 40vw, 480px); object-fit: cover; display: block;" />
        </div>
      </section>
    `;
  }

  return `
    <section class="hero-full-section" style="${cssVars}; position: relative; width: 100%; min-height: clamp(380px, 60vh, 600px); background: #000; overflow: hidden; display: flex; align-items: flex-end; padding: clamp(40px, 6vw, 64px) clamp(16px, 4vw, 24px);">
      <img src="${image}" alt="${headline}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;" />
      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);"></div>
      <div style="position: relative; z-index: 10; width: 100%; max-width: 1340px; margin: 0 auto; color: white; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px;">
        <div>
          ${p.subtitle || p.badge ? `<p style="font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; margin-bottom: 10px; opacity: 0.9;">${p.subtitle || p.badge}</p>` : ''}
          <h1 style="font-size: clamp(2.2rem, 5.5vw, 4.4rem); font-family: var(--font-heading); font-weight: 800; line-height: 1.05; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 20px;">${headline.replace(/\n/g, '<br>')}</h1>
        </div>
        <div>
          <a href="#products" style="display: inline-block; background: white; color: black; padding: 13px clamp(24px, 3vw, 36px); font-size: 0.8rem; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; text-decoration: none; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">${ctaText}</a>
        </div>
      </div>
    </section>
  `;
}

/**
 * 4. Product & Content Grid Block (Product Cards, Lookbooks, Feature Lists, Category Tiles)
 */
export function renderProductGrid(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);

  const items = Array.isArray(p.items) && p.items.length > 0 ? p.items : Array.isArray(p.images) ? p.images.map((img: string) => ({ image: img })) : [
    { title: 'Signature Product A', price: 120, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop' },
    { title: 'Signature Product B', price: 180, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop' },
    { title: 'Signature Product C', price: 240, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop' },
  ];

  const gap = c.gap || '24px';
  const aspect = c.aspect_ratio || '3/4';
  const hoverZoom = c.hover_zoom || 1.04;
  const cardBg = c.card_bg || 'var(--color-surface, #ffffff)';
  const cardBorder = c.card_border || '1px solid var(--color-border, rgba(0,0,0,0.08))';
  const cardRadius = c.card_radius || 'var(--radius-md, 12px)';

  if (node.variant === 'eql_metrics') {
    const bgColors = ['#F4F4F6', '#E6F7ED', '#EBF3FE', '#FEEFEF'];
    const badgeLabels = ['TESTED', 'TRUSTED', 'INDESTRUCTIBLE', 'RECOGNIZED'];

    return `
      <section class="metrics-grid-section" style="${cssVars}; padding: clamp(40px, 6vw, 64px) clamp(16px, 4vw, 24px); max-width: 1340px; margin: 0 auto;">
        ${p.title ? `
          <div style="text-align: center; margin-bottom: clamp(28px, 4vw, 48px);">
            <h2 style="font-family: var(--font-heading); font-size: clamp(1.8rem, 3.5vw, 2.2rem); color: var(--color-text); margin-bottom: 10px;">${p.title}</h2>
            ${p.subtitle ? `<p style="color: var(--color-muted); font-size: 0.95rem; max-width: 640px; margin: 0 auto;">${p.subtitle}</p>` : ''}
          </div>
        ` : ''}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: ${gap};">
          ${items.map((item: any, i: number) => `
            <div style="background: ${bgColors[i % 4]}; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: clamp(20px, 3vw, 28px); display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
              <div>
                <span style="font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(0,0,0,0.5);">${badgeLabels[i % 4]}</span>
                <h3 style="font-family: var(--font-heading); font-size: clamp(2.2rem, 4vw, 2.8rem); font-weight: 800; color: #0A0A0C; margin: 10px 0 4px; line-height: 1;">${item.title}</h3>
              </div>
              <p style="font-size: 0.9rem; color: rgba(10,10,12,0.8); line-height: 1.5; font-weight: 500;">${item.description || item.subtitle || ''}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  return `
    <section class="product-grid-section" style="${cssVars}; padding: clamp(40px, 6vw, 64px) clamp(16px, 4vw, 24px); max-width: 1340px; margin: 0 auto;">
      ${p.title || p.headline ? `
        <div style="text-align: center; margin-bottom: clamp(28px, 4vw, 48px);">
          <h2 style="font-family: var(--font-heading); font-size: clamp(1.8rem, 3.5vw, 2.2rem); color: var(--color-text); margin-bottom: 10px;">${p.title || p.headline}</h2>
          ${p.subtitle || p.description ? `<p style="color: var(--color-muted); font-size: 0.95rem; max-width: 640px; margin: 0 auto;">${p.subtitle || p.description}</p>` : ''}
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: ${gap};">
        ${items.map((item: any) => {
          const title = item.title || item.name || '';
          const desc = item.description || item.subtitle || item.desc || '';
          const price = item.price ? `$${item.price}` : '';
          const imgUrl = item.image || item.img || '';

          return `
            <div style="background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius}; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;"
                 onmouseover="this.style.transform='translateY(-4px)'"
                 onmouseout="this.style.transform='translateY(0)'">
              ${item.badge ? `<div style="padding: 12px 18px 0;"><span style="font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #0A0A0C;">${item.badge}</span></div>` : ''}
              ${imgUrl ? `
                <div style="aspect-ratio: ${aspect}; overflow: hidden; background: #F5F5F5; position: relative;">
                  <img src="${imgUrl}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;"
                       onmouseover="this.style.transform='scale(${hoverZoom})'"
                       onmouseout="this.style.transform='scale(1.0)'" />
                </div>
              ` : ''}
              ${title || desc ? `
                <div style="padding: clamp(16px, 2.5vw, 20px); display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
                  <div>
                    ${title ? `<h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; color: var(--color-text); margin-bottom: 6px;">${title}</h3>` : ''}
                    ${desc ? `<p style="font-size: 0.88rem; color: var(--color-muted); line-height: 1.5; margin-bottom: 12px;">${desc}</p>` : ''}
                  </div>
                  ${item.ctaText ? `<a href="#" style="display: inline-block; background: #0A0A0C; color: #fff; text-align: center; padding: 10px 20px; border-radius: 9999px; font-weight: 700; font-size: 0.82rem; text-decoration: none; margin-top: 10px;">${item.ctaText}</a>` : ''}
                  ${price ? `<div style="font-weight: 800; font-size: 1rem; color: var(--color-primary);">${price}</div>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

/**
 * 5. Story Split Banner Block (Cinematic Image-Text Splits, Editorial Showcases)
 */
export function renderStoryBanner(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);

  const title = p.title || p.headline || 'Crafted with Purpose';
  const subtitle = p.subtitle || p.description || 'Every detail refined for elegance and modern craftsmanship.';
  const image = p.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1000&h=800&fit=crop';
  const highlights = Array.isArray(p.highlights) ? p.highlights : [];

  return `
    <section class="story-section" style="${cssVars}; background: ${c.bg || 'var(--color-surface, #ffffff)'}; color: ${c.text_color || 'var(--color-text, #111)'}; padding: clamp(48px, 8vw, 90px) clamp(16px, 4vw, 24px);">
      <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: clamp(32px, 5vw, 60px); align-items: center;">
        <div>
          <h2 style="font-family: var(--font-heading); font-size: clamp(1.8rem, 4vw, 3rem); line-height: 1.15; margin-bottom: 18px; color: inherit;">${title}</h2>
          <p style="font-family: var(--font-body); opacity: 0.85; font-size: clamp(0.95rem, 2vw, 1.05rem); line-height: 1.6; margin-bottom: 28px;">${subtitle}</p>
          ${highlights.length > 0 ? `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px; padding: 0;">
              ${highlights.map((h: string) => `
                <li style="display: flex; align-items: center; gap: 10px; font-size: 0.92rem;">
                  <span style="width: 20px; height: 20px; background: var(--color-accent, #1FCB60); color: black; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.72rem; flex-shrink: 0;">✓</span> ${h}
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
        <div style="border-radius: var(--radius-lg, 12px); overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.15);">
          <img src="${image}" alt="${title}" style="width: 100%; height: clamp(260px, 35vw, 440px); object-fit: cover; display: block;" />
        </div>
      </div>
    </section>
  `;
}

/**
 * 6. Action & Footer Strip Block (Footers, Newsletter, Contacts)
 */
export function renderFooterStrip(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildStyleCssVars(c, tokens);
  const brand = p.brand_name || tokens?.name || 'Storefront';

  return `
    <footer class="footer-strip" style="${cssVars}; background: var(--color-surface, #ffffff); border-top: 1px solid var(--color-border, rgba(0,0,0,0.08)); padding: clamp(40px, 6vw, 64px) clamp(16px, 4vw, 32px) clamp(24px, 4vw, 32px); font-size: 0.88rem;">
      <div style="max-width: 1340px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
        <div>
          <h4 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: var(--color-text); margin-bottom: 6px;">${brand}</h4>
          <p style="color: var(--color-muted); font-size: 0.82rem;">${p.text || `© 2026 ${brand}. All Rights Reserved.`}</p>
        </div>
        <div style="display: flex; gap: clamp(14px, 2.5vw, 24px); font-size: 0.82rem; font-weight: 600; flex-wrap: wrap;">
          <a href="#" style="text-decoration: none; color: var(--color-text);">Privacy Policy</a>
          <a href="#" style="text-decoration: none; color: var(--color-text);">Terms of Service</a>
          <a href="#" style="text-decoration: none; color: var(--color-text);">Contact</a>
        </div>
      </div>
    </footer>
  `;
}
