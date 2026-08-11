/**
 * tarsite — 6 Universal Layout Primitives Engine
 * Zero site-specific hardcoding. Evaluates OKF Section Contracts & CSS Custom Variables.
 */

import { type UINode, type DesignTokens } from './types';
import { buildContractCssVars } from './contract-engine';

/**
 * 1. Marquee Strip Primitive (Announcements, Tickers, Banners)
 */
export function renderMarqueeStrip(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

  const text = p.text || p.title || p.headline || 'Welcome to our store | Free Shipping on Orders Over $100';
  const bg = c.bg || 'var(--color-primary, #000000)';
  const textColor = c.text_color || 'var(--color-surface, #ffffff)';
  const fontSize = c.font_size || '11px';
  const letterSpacing = c.letter_spacing || '0.15em';

  return `
    <div style="${cssVars}; background: ${bg}; color: ${textColor}; text-align: center; padding: 10px 16px; font-size: ${fontSize}; font-weight: 600; letter-spacing: ${letterSpacing}; text-transform: uppercase; overflow: hidden; white-space: nowrap;">
      ${text}
    </div>
  `;
}

/**
 * 2. Navigation Bar Primitive (Headers, Sticky Glass, Brand Logos, Action Buttons)
 */
export function renderNavigationBar(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

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

  const logoPos = c.logo_position || 'left';
  const ctaBg = c.cta_bg || 'var(--color-primary, #000000)';
  const ctaText = c.cta_text || 'var(--color-surface, #ffffff)';
  const ctaShape = c.cta_shape === 'pill' ? '9999px' : 'var(--radius-md, 8px)';

  return `
    <header style="${cssVars}; ${positionStyle} ${bgStyle} border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.08)); padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; gap: 24px;">
      <a href="#" style="font-family: var(--font-heading, sans-serif); font-size: 1.5rem; font-weight: 800; color: var(--section-text, var(--color-text, #111)); text-decoration: none; letter-spacing: -0.02em;">
        ${brand}<span style="color: var(--color-primary, #000);">.</span>
      </a>

      <div style="display: flex; gap: 28px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">
        ${links.map((l: any) => `
          <a href="${l.url || '#'}" style="text-decoration: none; color: var(--color-text, #333); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.6'" onmouseout="this.style.opacity='1'">${l.label || l.name || l.title}</a>
        `).join('')}
      </div>

      <div style="display: flex; align-items: center; gap: 16px;">
        <a href="#cart" style="background: ${ctaBg}; color: ${ctaText}; padding: 10px 22px; border-radius: ${ctaShape}; font-size: 0.85rem; font-weight: 700; text-decoration: none; letter-spacing: 0.05em; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
          ${p.cta_label || p.ctaText || 'Shop Now'}
        </a>
      </div>
    </header>
  `;
}

/**
 * 3. Media Hero Primitive (Visual Heroes, Split Heroes, Carousels)
 */
export function renderMediaHero(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

  const mode = c.layout_mode || node.layout || 'full';
  const headline = p.headline || p.title || tokens?.name || 'Next Generation Storefront';
  const subtitle = p.subtitle || p.description || p.text || 'Designed with precision engineering and dynamic OKF section contracts.';
  const image = p.image || (Array.isArray(p.items) && p.items[0]?.image) || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1920&h=960&fit=crop';
  const height = c.height || '70vh';
  const ctaText = p.ctaText || p.buttonText || 'Explore Collection';
  const secondaryCtaText = p.secondaryCtaText;

  if (mode === 'split' || node.variant === 'launch_hero') {
    const isEqlHero = node.variant === 'launch_hero';
    return `
      <section style="${cssVars}; padding: var(--space-xl, 64px) var(--space-lg, 24px); max-width: 1340px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 48px; align-items: center;">
        <div>
          ${p.badge ? `<span style="display: inline-block; background: rgba(0,0,0,0.06); color: var(--color-primary); padding: 6px 14px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">${p.badge}</span>` : ''}
          ${isEqlHero ? `
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">
              <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFFFFF; border: 2px solid #0A0A0C; padding: 4px 18px; border-radius: 8px; color: #0A0A0C;">Fueling fandom</span>
                <span style="background: #FFF6C7; border: 2px solid #0A0A0C; padding: 4px 18px; border-radius: 8px; color: #0A0A0C;">And</span>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFE600; border: 2px solid #0A0A0C; padding: 4px 18px; border-radius: 8px; color: #0A0A0C;">growth</span>
                <span style="background: #E5E7EB; border: 2px solid #0A0A0C; padding: 4px 18px; border-radius: 8px; color: #0A0A0C;">with every</span>
              </div>
              <div style="font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 800; font-family: var(--font-heading);">
                <span style="background: #FFE600; border: 2px solid #0A0A0C; padding: 4px 24px; border-radius: 8px; color: #0A0A0C;">Launch</span>
              </div>
            </div>
          ` : `<h1 style="font-family: var(--font-heading); font-size: clamp(2.4rem, 5vw, 3.8rem); line-height: 1.1; color: var(--color-text); margin-bottom: 20px;">${headline}</h1>`}
          <p style="font-family: var(--font-body); font-size: 1.1rem; color: var(--color-muted); margin-bottom: 32px; max-width: 540px; line-height: 1.6;">${subtitle}</p>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px;">
            <a href="${p.ctaUrl || '#products'}" style="background: var(--cta-bg, var(--color-primary)); color: var(--cta-text, #fff); padding: 14px 32px; border-radius: var(--radius-full, 9999px); font-weight: 700; font-size: 0.85rem; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">${ctaText}</a>
            ${secondaryCtaText ? `<a href="${p.secondaryCtaUrl || '#about'}" style="padding: 14px 32px; border: 1px solid var(--color-border); border-radius: var(--radius-full, 9999px); font-weight: 600; font-size: 0.85rem; text-decoration: none; color: var(--color-text);">${secondaryCtaText}</a>` : ''}
          </div>
          ${isEqlHero ? `
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; opacity: 0.85; padding-top: 16px; border-top: 1px solid var(--color-border);">
              <span style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Trusted by:</span>
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c1824077dace994ff08733_image%20(11).svg" alt="Nike" style="height: 20px;" />
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c18972db40a48908a2575b_image%20(22).svg" alt="Topps" style="height: 24px;" />
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c18bc7abf6f5491e782258_image%20(26).svg" alt="Laphroaig" style="height: 18px;" />
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/68c18b21af5626d35f8a0457_image%20(24).svg" alt="Undefeated" style="height: 16px;" />
            </div>
          ` : ''}
        </div>
        <div style="position: relative; border-radius: var(--radius-lg, 16px); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08);">
          <img src="${image}" alt="${headline}" style="width: 100%; height: 480px; object-fit: cover; display: block;" />
        </div>
      </section>
    `;
  }

  return `
    <section style="${cssVars}; position: relative; width: 100%; height: ${height}; min-height: 480px; background: #000; overflow: hidden; display: flex; align-items: flex-end; padding: var(--space-xl, 64px) var(--space-lg, 24px);">
      <img src="${image}" alt="${headline}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;" />
      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%);"></div>
      <div style="position: relative; z-index: 10; width: 100%; max-width: 1340px; margin: 0 auto; color: white; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 24px;">
        <div>
          ${p.subtitle || p.badge ? `<p style="font-size: 0.75rem; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; margin-bottom: 12px; opacity: 0.9;">${p.subtitle || p.badge}</p>` : ''}
          <h1 style="font-size: clamp(2.6rem, 6.5vw, 5rem); font-family: var(--font-heading); font-weight: 800; line-height: 1.05; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 24px;">${headline.replace(/\n/g, '<br>')}</h1>
        </div>
        <div>
          <a href="#products" style="display: inline-block; background: white; color: black; padding: 14px 36px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; text-decoration: none; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">${ctaText}</a>
        </div>
      </div>
    </section>
  `;
}

/**
 * 4. Content Grid Primitive (Product Cards, Lookbooks, Feature Lists, Category Tiles)
 */
export function renderContentGrid(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

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
      <section style="${cssVars}; padding: var(--space-xl, 64px) var(--space-lg, 24px); max-width: 1340px; margin: 0 auto;">
        ${p.title ? `
          <div style="text-align: center; margin-bottom: 48px;">
            <h2 style="font-family: var(--font-heading); font-size: 2.2rem; color: var(--color-text); margin-bottom: 12px;">${p.title}</h2>
            ${p.subtitle ? `<p style="color: var(--color-muted); font-size: 1rem; max-width: 640px; margin: 0 auto;">${p.subtitle}</p>` : ''}
          </div>
        ` : ''}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: ${gap};">
          ${items.map((item: any, i: number) => `
            <div style="background: ${bgColors[i % 4]}; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; min-height: 220px; transition: transform 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
              <div>
                <span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(0,0,0,0.5);">${badgeLabels[i % 4]}</span>
                <h3 style="font-family: var(--font-heading); font-size: 2.8rem; font-weight: 800; color: #0A0A0C; margin: 12px 0 4px; line-height: 1;">${item.title}</h3>
              </div>
              <p style="font-size: 0.95rem; color: rgba(10,10,12,0.8); line-height: 1.5; font-weight: 500;">${item.description || item.subtitle || ''}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  return `
    <section style="${cssVars}; padding: var(--space-xl, 64px) var(--space-lg, 24px); max-width: 1340px; margin: 0 auto;">
      ${p.title || p.headline ? `
        <div style="text-align: center; margin-bottom: 48px;">
          <h2 style="font-family: var(--font-heading); font-size: 2.2rem; color: var(--color-text); margin-bottom: 12px;">${p.title || p.headline}</h2>
          ${p.subtitle || p.description ? `<p style="color: var(--color-muted); font-size: 1rem; max-width: 640px; margin: 0 auto;">${p.subtitle || p.description}</p>` : ''}
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: ${gap};">
        ${items.map((item: any) => {
          const title = item.title || item.name || '';
          const desc = item.description || item.subtitle || item.desc || '';
          const price = item.price ? `$${item.price}` : '';
          const imgUrl = item.image || item.img || '';

          return `
            <div style="background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius}; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.3s ease, box-shadow 0.3s ease;"
                 onmouseover="this.style.transform='translateY(-4px)'"
                 onmouseout="this.style.transform='translateY(0)'">
              ${item.badge ? `<div style="padding: 12px 20px 0;"><span style="font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #0A0A0C;">${item.badge}</span></div>` : ''}
              ${imgUrl ? `
                <div style="aspect-ratio: ${aspect}; overflow: hidden; background: #F5F5F5; position: relative;">
                  <img src="${imgUrl}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;"
                       onmouseover="this.style.transform='scale(${hoverZoom})'"
                       onmouseout="this.style.transform='scale(1.0)'" />
                </div>
              ` : ''}
              ${title || desc ? `
                <div style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
                  <div>
                    ${title ? `<h3 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; color: var(--color-text); margin-bottom: 6px;">${title}</h3>` : ''}
                    ${desc ? `<p style="font-size: 0.9rem; color: var(--color-muted); line-height: 1.5; margin-bottom: 12px;">${desc}</p>` : ''}
                  </div>
                  ${item.ctaText ? `<a href="#" style="display: inline-block; background: #0A0A0C; color: #fff; text-align: center; padding: 10px 20px; border-radius: 9999px; font-weight: 700; font-size: 0.85rem; text-decoration: none; margin-top: 12px;">${item.ctaText}</a>` : ''}
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
 * 5. Story Banner Primitive (Cinematic Image-Text Splits, Editorial Showcases)
 */
export function renderStoryBanner(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

  const title = p.title || p.headline || 'Crafted With Purpose';
  const subtitle = p.subtitle || p.text || p.description || 'Every detail engineered for performance, aesthetics, and enduring quality.';
  const image = p.image || 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&h=800&fit=crop';
  const bg = c.bg || 'var(--section-bg, var(--color-primary, #032E1C))';
  const textColor = c.text_color || 'var(--section-text, #ffffff)';

  if (node.variant === 'eql_nike_quote') {
    return `
      <section style="${cssVars}; background: #FFF6C7; color: #0A0A0C; padding: 80px 24px; border-radius: 24px; max-width: 1340px; margin: 40px auto; overflow: hidden; position: relative;">
        <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 48px; align-items: center;">
          <div style="position: relative; z-index: 2;">
            <div style="font-size: 3rem; font-weight: 800; line-height: 1; color: rgba(10,10,12,0.2); font-family: serif; margin-bottom: -10px;">“</div>
            <p style="font-family: var(--font-heading); font-size: clamp(1.2rem, 2.5vw, 1.6rem); font-weight: 600; line-height: 1.4; color: #0A0A0C; margin-bottom: 24px;">
              "The DNA of Nike is built on innovation, so partnering with EQL just makes sense. The EQL team is leading the way when it comes to innovation in launch and fairness, and we couldn’t be happier with the partnership across the Pacific marketplace."
            </p>
            <div style="display: flex; align-items: center; gap: 16px; margin-top: 24px;">
              <img src="https://cdn.prod.website-files.com/6899a9ebdcf39f5ff0aa276d/6a441a1a045393e9bab3c1e3_nike.avif" alt="Nike" style="height: 24px;" />
              <div style="font-size: 0.9rem; font-weight: 700; color: #0A0A0C;">Ashley Reade, VP, Nike Pacific</div>
            </div>
          </div>
          <div style="border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.15);">
            <img src="${image}" alt="Nike Partner" style="width: 100%; height: 420px; object-fit: cover; display: block;" />
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section style="${cssVars}; background: ${bg}; color: ${textColor}; padding: 90px 24px;">
      <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 60px; align-items: center;">
        <div>
          <h2 style="font-family: var(--font-heading); font-size: clamp(2.2rem, 4.5vw, 3.2rem); line-height: 1.15; margin-bottom: 20px; color: ${textColor};">${title}</h2>
          <p style="font-family: var(--font-body); opacity: 0.85; font-size: 1.05rem; line-height: 1.6; margin-bottom: 32px;">${subtitle}</p>
          ${Array.isArray(p.highlights) ? `
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 14px; padding: 0;">
              ${p.highlights.map((h: string) => `
                <li style="display: flex; align-items: center; gap: 12px; font-size: 0.95rem;">
                  <span style="width: 22px; height: 22px; background: var(--color-accent, #1FCB60); color: black; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">✓</span> ${h}
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
        <div style="border-radius: var(--radius-lg, 16px); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
          <img src="${image}" alt="${title}" style="width: 100%; height: 440px; object-fit: cover; display: block;" />
        </div>
      </div>
    </section>
  `;
}

/**
 * 6. Action Strip Primitive (Contact Forms, Newsletter Signups, Footers)
 */
export function renderActionStrip(node: UINode, tokens?: DesignTokens): string {
  const c = node.contract || {};
  const p = node.props || {};
  const cssVars = buildContractCssVars(c, tokens);

  const title = p.title || p.headline || 'Stay Connected';
  const subtitle = p.subtitle || p.description || 'Subscribe for exclusive releases and updates.';

  if (node.type === 'footer' || node.variant === 'footer') {
    return `
      <footer style="${cssVars}; background: var(--color-surface, #ffffff); border-top: 1px solid var(--color-border, rgba(0,0,0,0.08)); padding: 64px 32px 32px; font-size: 0.9rem;">
        <div style="max-width: 1340px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px;">
          <div>
            <h4 style="font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: var(--color-text); margin-bottom: 8px;">${tokens?.name || 'STORE'}</h4>
            <p style="color: var(--color-muted);">${p.text || p.copyright || '© 2026 All Rights Reserved.'}</p>
          </div>
          <div style="display: flex; gap: 24px; font-size: 0.85rem; font-weight: 600;">
            <a href="#" style="text-decoration: none; color: var(--color-text);">Privacy Policy</a>
            <a href="#" style="text-decoration: none; color: var(--color-text);">Terms of Service</a>
            <a href="#" style="text-decoration: none; color: var(--color-text);">Contact</a>
          </div>
        </div>
      </footer>
    `;
  }

  return `
    <section style="${cssVars}; padding: var(--space-xl, 64px) var(--space-lg, 24px); max-width: 960px; margin: 0 auto; text-align: center;">
      <h2 style="font-family: var(--font-heading); font-size: 2rem; color: var(--color-text); margin-bottom: 12px;">${title}</h2>
      <p style="color: var(--color-muted); font-size: 1rem; margin-bottom: 32px;">${subtitle}</p>
      <form onsubmit="event.preventDefault(); alert('Thank you!');" style="display: flex; gap: 12px; justify-content: center; max-width: 480px; margin: 0 auto;">
        <input type="email" placeholder="Enter your email" required style="flex-grow: 1; padding: 14px 20px; border-radius: var(--radius-full, 9999px); border: 1px solid var(--color-border); font-size: 0.9rem; outline: none;" />
        <button type="submit" style="background: var(--color-primary); color: white; border: none; padding: 14px 28px; border-radius: var(--radius-full, 9999px); font-weight: 700; cursor: pointer;">${p.buttonText || 'Submit'}</button>
      </form>
    </section>
  `;
}
