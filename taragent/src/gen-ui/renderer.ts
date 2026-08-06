/**
 * Section Renderer — Framer & Webflow Quality Anti-Slop Engine
 * Transforms SiteLayout JSON nodes into high-converting, modern, uncluttered HTML.
 */

import type { SiteLayout, UINode } from './types';
import { getDesignSpec, getDesignSections } from './design-specs-registry';
import { renderFromSpec } from './md-section-parser';

function esc(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cssToInline(css: Record<string, any> | undefined): string {
  if (!css) return '';
  return Object.entries(css)
    .map(([k, v]) => {
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}:${v}`;
    })
    .join(';');
}

function generateMediaQueries(node: UINode): string {
  const responsive = (node as any).responsive;
  if (!responsive) return '';

  const queries: string[] = [];
  if (responsive.mobile?.css) {
    const styles = cssToInline(responsive.mobile.css);
    if (styles) {
      queries.push(`@media(max-width:768px){.node-${node.id}{${styles}}}`);
    }
  }

  return queries.join('\n');
}

// Helper to convert hex to rgb
function hexToRgb(hex: string): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '200, 109, 81';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

// Helper for Smart Fallback Images matching item name/context (No Emoji Slop!)
function getFallbackImage(name: string, categoryName: string = ''): string {
  const text = (name + ' ' + categoryName).toLowerCase();

  if (/coffee|espresso|latte|cappuccino|mocha|brew|cafe/i.test(text)) {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80';
  }
  if (/pizza|mozzarella|crust|slice/i.test(text)) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80';
  }
  if (/cake|pastry|bakery|croissant|bread|dessert|donut|cookie/i.test(text)) {
    return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';
  }
  if (/burger|sandwich|fries|meal|dining|food/i.test(text)) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80';
  }
  if (/watch|gadget|tech|headphone|audio|speaker|device|phone/i.test(text)) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80';
  }
  if (/cloth|shirt|jacket|fashion|bag|wear|apparel|shoe/i.test(text)) {
    return 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80';
  }

  return 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80';
}

// ── Section Renderers ─────────────────────────────────────────────

function renderHeaderNav(workspaceName: string, template: string = ''): string {
  if (template === 'lululemon') {
    return `<div class="lulu-top-announcement">
      <span class="lulu-arrow">&lt;</span>
      <span class="lulu-top-text">Made to feel good on the move—explore the <a href="#women">women's</a> and <a href="#men">men's</a> travel shop.</span>
      <span class="lulu-arrow">&gt;</span>
    </div>
    <header class="lulu-header">
      <div class="lulu-header-inner">
        <div class="lulu-brand">
          <svg class="lulu-logo-icon" viewBox="0 0 24 24" width="24" height="24" fill="#D31334"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-2.05.78-3.91 2.05-5.32 1.34 1.86 3.51 3.07 5.95 3.07s4.61-1.21 5.95-3.07C19.22 8.09 20 9.95 20 12c0 4.41-3.59 8-8 8z"/></svg>
          <span class="lulu-wordmark">lululemon</span>
        </div>
        <nav class="lulu-nav-menu">
          <a href="#women" class="lulu-nav-link active">Women</a>
          <a href="#men" class="lulu-nav-link">Men</a>
          <a href="#accessories" class="lulu-nav-link">Accessories</a>
          <a href="#bags" class="lulu-nav-link">Bags</a>
          <a href="#new" class="lulu-nav-link">What's New</a>
          <a href="#community" class="lulu-nav-link">The Community</a>
        </nav>
        <div class="lulu-header-actions">
          <div class="lulu-search-box">
            <span class="lulu-search-icon">🔍</span>
            <input type="text" placeholder="Search" class="lulu-search-input" />
          </div>
          <div class="lulu-region-select">
            <span class="lulu-region-icon">🌐</span>
            <span class="lulu-region-text">United Kingdom (GBP)</span>
          </div>
          <a href="#account" class="lulu-user-icon">👤</a>
          <a href="#bag" class="lulu-bag-icon">🛍️</a>
        </div>
      </div>
    </header>`;
  }

  if (template === 'editorial-chalk') {
    return `<header class="pouch-header">
      <div class="pouch-header-inner">
        <a href="#" class="pouch-brand-logo">${esc(workspaceName.toUpperCase())}</a>
        <div class="pouch-pill-nav">
          <a href="#products" class="pouch-nav-link">PRODUCTS</a>
          <a href="#about" class="pouch-nav-link">ABOUT</a>
          <a href="#science" class="pouch-nav-link">OVERVIEW</a>
          <a href="#faqs" class="pouch-nav-link">FAQS</a>
        </div>
        <div class="pouch-pill-actions">
          <a href="#search" class="pouch-action-link">SEARCH_</a>
          <span class="pouch-action-link">EN •</span>
          <a href="#account" class="pouch-action-link">ACCOUNT</a>
          <a href="#bag" class="pouch-bag-link">BAG [0]</a>
        </div>
      </div>
    </header>`;
  }

  return `<header class="site-header">
    <div class="nav-container">
      <a href="#" class="brand-logo">${esc(workspaceName)}</a>
      <nav class="nav-menu">
        <a href="#products" class="nav-link">Products</a>
        <a href="#about" class="nav-link">About</a>
        <a href="#reviews" class="nav-link">Reviews</a>
        <a href="#contact" class="nav-link">Contact</a>
      </nav>
      <a href="#contact" class="btn btn-primary nav-cta">Get Started</a>
    </div>
  </header>`;
}

function renderAnnouncementBar(node: UINode): string {
  const p = node.props;
  const text = p.text || p.message || p.title || '';
  if (!text) return '';

  return `<div class="announcement-bar node-${node.id}">
    <marquee-loop class="announcement-marquee">
      <div class="track">
        <span class="slide">${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
        <span class="slide">${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp; ${esc(text)} &nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
      </div>
    </marquee-loop>
  </div>`;
}

function renderHeroBanner(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const badge = p.badge || p.tag || '';
  const title = p.title || p.headline || p.text || 'Flow Y is back at it.';
  const subtitle = p.subtitle || p.subtext || 'New, buttery-soft styles with a minimalist design that keep your summer moving.';
  const ctaText = p.ctaText || p.cta?.label || p.cta || "Shop Women's Yoga and Pilates";
  const ctaUrl = p.ctaUrl || p.cta?.url || '#products';
  const secondaryCtaText = p.secondaryCtaText || "Shop Women's What's New";

  if (template === 'lululemon' || variant === 'lululemon-hero') {
    const bgImg = p.image || p.imageUrl || 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80';
    return `<section class="lulu-hero-section node-${node.id}">
      <div class="lulu-hero-bg" style="background-image: linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.15) 100%), url('${esc(bgImg)}');"></div>
      <div class="lulu-hero-container">
        <div class="lulu-hero-content">
          ${title ? `<h1 class="lulu-hero-title">${esc(title)}</h1>` : ''}
          ${subtitle ? `<p class="lulu-hero-subtitle">${esc(subtitle)}</p>` : ''}
          <div class="lulu-hero-cta-box">
            <a href="${esc(ctaUrl)}" class="btn-lulu-pill">${esc(ctaText)}</a>
            ${secondaryCtaText ? `<a href="#new" class="btn-lulu-pill">${esc(secondaryCtaText)}</a>` : ''}
          </div>
        </div>
        <div class="lulu-hero-controls">
          <button class="lulu-ctrl-btn">▶</button>
          <button class="lulu-ctrl-btn">←</button>
          <button class="lulu-ctrl-btn">→</button>
        </div>
      </div>
    </section>`;
  }

  if (template === 'editorial-chalk' || variant === 'fullscreen-bg') {
    const bgImg = p.image || p.imageUrl || getFallbackImage(title, 'hero');
    return `<section class="pouch-hero-section node-${node.id}">
      <div class="pouch-hero-bg" style="background-image: linear-gradient(to top, rgba(1, 39, 62, 0.9) 0%, rgba(1, 39, 62, 0.3) 100%), url('${esc(bgImg)}');"></div>
      <div class="pouch-hero-container">
        <div class="pouch-hero-content">
          ${title ? `<h1 class="pouch-hero-title">${esc(title)}</h1>` : ''}
          ${subtitle ? `<p class="pouch-hero-subtitle">${esc(subtitle)}</p>` : ''}
          <div class="pouch-hero-cta-box">
            <a href="${esc(ctaUrl)}" class="btn btn-pouch-blue">${esc(ctaText)} &rarr;</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  const imageUrl = p.image || p.imageUrl || getFallbackImage(title, 'hero');

  return `<section class="hero-section node-${node.id}" style="${css}">
    <div class="hero-container">
      <div class="hero-content">
        ${badge ? `<div class="pill-badge"><span class="badge-dot"></span>${esc(badge)}</div>` : ''}
        ${title ? `<h1 class="hero-title">${esc(title)}</h1>` : ''}
        ${subtitle ? `<p class="hero-subtitle">${esc(subtitle)}</p>` : ''}
        <div class="hero-cta-group">
          <a href="${esc(ctaUrl)}" class="btn btn-primary">${esc(ctaText)} &rarr;</a>
          ${secondaryCtaText ? `<a href="#about" class="btn btn-secondary">${esc(secondaryCtaText)}</a>` : ''}
        </div>
      </div>
      <div class="hero-media">
        <img src="${esc(imageUrl)}" alt="${esc(title)}" class="hero-img" loading="eager" />
      </div>
    </div>
  </section>`;
}

function renderProductGrid(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const title = p.title || 'Shop by solution';
  const subtitle = p.subtitle || 'Wellness that adapts to you. Each POUCH formula delivers targeted support for hydration, immunity, skin health, and complete wellness.';
  const items = p.items || p.products || [
    { name: 'Immunity+', flavor: 'Raspberry Ginger', formula: 'Strengthen, Defend, Thrive', volume: '8.0 oz', price: 340, badge: 'Daily Defense', tags: ['0G SUGAR', '5 CALORIES'], ingredients: ['VitAlign®', 'Magnesium', 'Vitamin C', 'Glutathione', 'Zinc'] },
    { name: 'Hydration+', flavor: 'Lemon', formula: 'Cellular Replenishment Formula', volume: '8.0 oz', price: 320, badge: 'Replenishment', tags: ['0G SUGAR', '5 CALORIES'], ingredients: ['Aquamin™', 'Essential Electrolytes', 'Vitamin C'] },
    { name: 'SkinRevive+', flavor: 'Peach Chamomile', formula: 'Complexion Care Formula', volume: '8.0 oz', price: 360, badge: 'Skin Support', tags: ['0G SUGAR', '5 CALORIES'], ingredients: ['Hyaluronic Acid', 'Glutathione', 'Vitamin E', 'Vitamin C'] },
    { name: 'WellDrip+', flavor: 'Orange Honey', formula: 'All-in-One Wellness Formula', volume: '8.0 oz', price: 380, badge: 'All-In-One', tags: ['0G SUGAR', '5 CALORIES'], ingredients: ['Vitamin C', 'Glutathione', 'Selenium', 'Magnesium', 'Zinc'] }
  ];

  if (template === 'editorial-chalk' || variant === 'spec-cards') {
    const cardsHtml = items.map((item: any, i: number) => {
      const name = typeof item === 'string' ? item : item.name || `Formula ${i + 1}`;
      const flavor = item.flavor || 'Signature Blend';
      const formula = item.formula || item.description || 'Targeted Wellness Support';
      const volume = item.volume || '8.0 oz';
      const badge = item.badge || 'POUCH Formula';
      const price = item.price ? `₹${item.price}` : '';
      const tags = item.tags || ['0G SUGAR', '5 CALORIES'];
      const ingredients = item.ingredients || ['VitAlign®', 'Glutathione', 'Vitamin C', 'Zinc'];
      const imgUrl = item.image || item.imageUrl || 'https://www.drinkpouch.com/cdn/shop/files/Pouch_SH030_-_S.jpg?v=1768594595';

      const tagHtml = tags.map((t: string) => `<span class="pouch-card-tag">${esc(t)}</span>`).join('');
      const ingHtml = ingredients.map((ing: string) => `<span class="pouch-card-ing">${esc(ing)}</span>`).join('');

      return `<article class="pouch-product-card">
        <div class="pouch-card-image-box">
          <img src="${esc(imgUrl)}" alt="${esc(name)}" class="pouch-card-img" loading="lazy" />
          <span class="pouch-card-badge">${esc(badge)}</span>
        </div>
        <div class="pouch-card-content">
          <div class="pouch-card-top-row">
            <span class="pouch-flavor-name">${esc(flavor)}</span>
            <span class="pouch-volume-tag">${esc(volume)}</span>
          </div>
          <div class="pouch-card-header">
            <h3 class="pouch-product-name">${esc(name)}</h3>
            ${price ? `<span class="pouch-product-price">${esc(price)}</span>` : ''}
          </div>
          <p class="pouch-formula-sub">${esc(formula)}</p>
          <div class="pouch-card-nutrition">
            ${tagHtml}
          </div>
          <div class="pouch-card-ingredients">
            ${ingHtml}
          </div>
          <button class="btn btn-pouch-blue btn-full" style="margin-top: 20px;">ADD TO BAG</button>
        </div>
      </article>`;
    }).join('\n');

    return `<section class="section-container node-${node.id} pouch-products-section" id="products">
      <div class="editorial-meta-header">
        <span class="meta-num">01 /</span>
        <span class="meta-label">OUR FORMULAS</span>
      </div>
      <div class="section-header-box text-left">
        <h2 class="section-title text-left">${esc(title)}</h2>
        ${subtitle ? `<p class="editorial-statement-desc">${esc(subtitle)}</p>` : ''}
      </div>
      <div class="pouch-product-grid">
        ${cardsHtml}
      </div>
    </section>`;
  }

  const cardsHtml = items.map((item: any, i: number) => {
    const name = typeof item === 'string' ? item : item.name || item.title || `Item ${i + 1}`;
    const price = typeof item === 'string' ? '' : item.price != null ? `₹${item.price}` : '';
    const desc = typeof item === 'string' ? '' : item.description || '';
    const badge = typeof item === 'string' ? '' : item.badge || '';
    const imgUrl = (typeof item !== 'string' && (item.image || item.imageUrl)) ? (item.image || item.imageUrl) : getFallbackImage(name, title);

    return `<article class="product-card">
      <div class="product-img-box">
        <img src="${esc(imgUrl)}" alt="${esc(name)}" class="product-img" loading="lazy"/>
        ${badge ? `<span class="product-card-badge">${esc(badge)}</span>` : ''}
      </div>
      <div class="product-card-body">
        <div class="product-card-header">
          <h3 class="product-title">${esc(name)}</h3>
          ${price ? `<span class="product-price">${esc(price)}</span>` : ''}
        </div>
        ${desc ? `<p class="product-desc">${esc(desc)}</p>` : ''}
        <div class="product-card-footer">
          <button class="btn-card-action">Add to Order</button>
        </div>
      </div>
    </article>`;
  }).join('\n');

  return `<section class="section-container node-${node.id}" id="products" style="${css}">
    <div class="section-header-box">
      ${title ? `<h2 class="section-title">${esc(title)}</h2>` : ''}
      ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ''}
    </div>
    <div class="product-grid">
      ${cardsHtml}
    </div>
  </section>`;
}

function renderServiceList(node: UINode): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const title = p.title || 'Our Specialties';
  const subtitle = p.subtitle || '';
  const items = p.items || p.services || [];

  const cardsHtml = items.map((item: any, i: number) => {
    const name = typeof item === 'string' ? item : item.name || item.title || `Specialty ${i + 1}`;
    const price = typeof item === 'string' ? '' : item.price != null ? `₹${item.price}` : '';
    const desc = typeof item === 'string' ? '' : item.description || '';

    return `<div class="service-card">
      <div class="service-card-header">
        <span class="service-num">0${i + 1}</span>
        <h3 class="service-title">${esc(name)}</h3>
      </div>
      ${desc ? `<p class="service-desc">${esc(desc)}</p>` : ''}
      ${price ? `<div class="service-price">${esc(price)}</div>` : ''}
    </div>`;
  }).join('\n');

  return `<section class="section-container node-${node.id}" id="services" style="${css}">
    <div class="section-header-box">
      ${title ? `<h2 class="section-title">${esc(title)}</h2>` : ''}
      ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ''}
    </div>
    <div class="service-grid">
      ${cardsHtml}
    </div>
  </section>`;
}

function renderTestimonials(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const title = p.title || p.headline || 'Community Reviews';
  const subtitle = p.subtitle || 'Real results from high-performers, athletes, and daily users.';

  if (template === 'editorial-chalk' || variant === 'split-image-quote') {
    const pouchTitle = (!p.title || p.title === 'Customer Reviews' || p.title === 'Loved by Guests') ? 'Community Reviews' : p.title;
    const pouchSub = (!p.subtitle || p.subtitle.toLowerCase().includes('guest') || p.subtitle.toLowerCase().includes('community')) ? 'Real results from high-performers, athletes, and daily users.' : p.subtitle;

    const pouchReviews = [
      { quote: 'Replaced my afternoon coffee and IV drips. Hydration+ gives me clean focus without any jitters.', author: 'Marcus Vance', role: 'Pro Triathlete & Founder' },
      { quote: 'SkinRevive+ has completely changed my skin clarity and hydration levels after long travel days.', author: 'Elena Rostova', role: 'Editorial Director' },
      { quote: 'Immunity+ is a non-negotiable for my daily routine. Bioavailability you can actually feel.', author: 'Dr. Julian Thorne', role: 'Performance Medicine Specialist' }
    ];

    const cardsHtml = pouchReviews.map((item: any) => `
      <div class="pouch-review-card">
        <div class="pouch-review-stars">★★★★★</div>
        <blockquote class="pouch-review-quote">"${esc(item.quote)}"</blockquote>
        <div class="pouch-review-author-box">
          <strong class="pouch-review-author">${esc(item.author)}</strong>
          <span class="pouch-review-role">${esc(item.role)}</span>
        </div>
      </div>
    `).join('\n');

    return `<section class="section-container node-${node.id} pouch-reviews-section" id="reviews">
      <div class="editorial-meta-header">
        <span class="meta-num">05 /</span>
        <span class="meta-label">COMMUNITY REVIEWS</span>
      </div>
      <div class="section-header-box text-left">
        <h2 class="section-title text-left">${esc(pouchTitle)}</h2>
        ${pouchSub ? `<p class="editorial-statement-desc">${esc(pouchSub)}</p>` : ''}
      </div>
      <div class="pouch-reviews-grid">
        ${cardsHtml}
      </div>
    </section>`;
  }

  const items = p.items || p.quotes || p.reviews || [];
  const cardsHtml = items.map((q: any, i: number) => {
    const quote = typeof q === 'string' ? q : q.quote || q.text || '';
    const author = typeof q === 'string' ? 'Verified Guest' : q.author || q.name || 'Guest';
    const role = typeof q === 'string' ? '' : q.role || 'Regular Customer';
    const rating = typeof q === 'string' ? 5 : q.rating || 5;
    const stars = '★'.repeat(Math.min(5, Math.max(1, rating)));
    const initial = author.charAt(0).toUpperCase();

    return `<div class="testimonial-card">
      <div class="star-rating">${stars}</div>
      <blockquote class="testimonial-quote">"${esc(quote)}"</blockquote>
      <div class="testimonial-author-box">
        <div class="author-avatar">${esc(initial)}</div>
        <div>
          <div class="author-name">${esc(author)}</div>
          ${role ? `<div class="author-role">${esc(role)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('\n');

  return `<section class="section-container node-${node.id}" id="reviews" style="${css}">
    <div class="section-header-box">
      ${title ? `<h2 class="section-title">${esc(title)}</h2>` : ''}
      ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ''}
    </div>
    <div class="testimonial-grid">
      ${cardsHtml}
    </div>
  </section>`;
}

function renderContactForm(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const pouchTitle = (!p.title || p.title === 'Get In Touch' || p.title === 'Contact Us') ? 'Inside POUCH' : p.title;
  const pouchSub = (!p.subtitle || p.subtitle.toLowerCase().includes('question') || p.subtitle.toLowerCase().includes('24 hours')) ? 'Join the POUCH list for free ground shipping on your first order, plus early access to news and exclusive offers.' : p.subtitle;

  if (template === 'editorial-chalk' || variant === 'newsletter') {
    return `<section class="section-container node-${node.id} pouch-newsletter-section" id="contact">
      <div class="pouch-newsletter-box">
        <h2 class="pouch-newsletter-title">${esc(pouchTitle)}</h2>
        <p class="pouch-newsletter-sub">${esc(pouchSub)}</p>
        <form class="pouch-newsletter-form" onsubmit="event.preventDefault(); alert('Thank you for subscribing!');">
          <div class="pouch-form-row">
            <input type="text" class="pouch-input" placeholder="FIRST NAME" required />
            <input type="text" class="pouch-input" placeholder="LAST NAME" required />
          </div>
          <div class="pouch-form-inline">
            <input type="email" class="pouch-input flex-1" placeholder="EMAIL ADDRESS" required />
            <button type="submit" class="btn btn-pouch-blue">SIGN UP</button>
          </div>
          <label class="pouch-checkbox-label">
            <input type="checkbox" checked />
            <span>POUCH can contact me via email about promotions and content.</span>
          </label>
        </form>
      </div>
    </section>`;
  }

  const title = p.title || 'Get In Touch';
  const subtitle = p.subtitle || 'Reserve a table or ask us anything';
  const submitLabel = p.submit_label || 'Send Inquiry';

  return `<section class="section-container node-${node.id}" id="contact" style="${css}">
    <div class="contact-card">
      <div class="section-header-box">
        ${title ? `<h2 class="section-title">${esc(title)}</h2>` : ''}
        ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      <form class="contact-form" onsubmit="event.preventDefault(); alert('Thank you! We will get back to you shortly.');">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" placeholder="Alex Morgan" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" placeholder="alex@example.com" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Your Message / Request</label>
          <textarea class="form-input" rows="4" placeholder="Tell us how we can help you..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${esc(submitLabel)}</button>
      </form>
    </div>
  </section>`;
}

function renderHours(node: UINode): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const title = p.title || 'Opening Hours';
  const hours = p.hours || p.body || p.text || 'Monday – Sunday: 7:00 AM – 9:00 PM';

  return `<section class="section-container node-${node.id}" id="about" style="${css}">
    <div class="hours-card">
      <h3 class="hours-title">${esc(title)}</h3>
      <p class="hours-text">${esc(hours)}</p>
    </div>
  </section>`;
}

function renderFooter(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const brandName = p.workspaceName || 'DRINK POUCH';
  const text = p.text || `©${new Date().getFullYear()} / ${brandName.toUpperCase()}`;

  if (template === 'editorial-chalk' || variant === 'multi-column-border') {
    return `<footer class="pouch-footer node-${node.id}" style="${css}">
      <div class="pouch-footer-grid">
        <div class="pouch-footer-col">
          <div class="pouch-footer-col-header">01 / CUSTOMER SERVICE</div>
          <a href="#faqs" class="pouch-footer-link">FAQs</a>
          <a href="#delivery" class="pouch-footer-link">Delivery</a>
          <a href="#returns" class="pouch-footer-link">Returns</a>
          <a href="#subscriptions" class="pouch-footer-link">&nearr; Manage Subscriptions</a>
        </div>
        <div class="pouch-footer-col">
          <div class="pouch-footer-col-header">02 / LEGAL</div>
          <a href="#terms" class="pouch-footer-link">Terms & Conditions</a>
          <a href="#privacy" class="pouch-footer-link">Privacy Policy</a>
          <a href="#cookie" class="pouch-footer-link">Cookie Policy</a>
          <a href="#contact" class="pouch-footer-link">Contact</a>
        </div>
        <div class="pouch-footer-col">
          <div class="pouch-footer-col-header">03 / FOLLOW</div>
          <a href="https://instagram.com" target="_blank" class="pouch-footer-link">&nearr; Instagram</a>
          <a href="https://tiktok.com" target="_blank" class="pouch-footer-link">&nearr; TikTok</a>
          <a href="https://facebook.com" target="_blank" class="pouch-footer-link">&nearr; Facebook</a>
          <a href="https://linkedin.com" target="_blank" class="pouch-footer-link">&nearr; LinkedIn</a>
        </div>
      </div>
      <div class="pouch-footer-bottom-grid">
        <div class="pouch-footer-bottom-col">${esc(text)}</div>
        <div class="pouch-footer-bottom-col">MIA/USA 14:22:33</div>
        <div class="pouch-footer-bottom-col text-right">DRINKABLE IV FORMULA™</div>
      </div>
    </footer>`;
  }

  return `<footer class="site-footer node-${node.id}" style="${css}">
    <div class="footer-container">
      <div class="footer-col footer-brand-col">
        <div class="footer-brand">${esc(brandName)}</div>
        <p class="footer-tagline">Crafting exceptional moments, everyday.</p>
      </div>
      <div class="footer-col">
        <h4 class="footer-col-title">Navigation</h4>
        <a href="#products" class="footer-link">Menu</a>
        <a href="#services" class="footer-link">Specialties</a>
        <a href="#reviews" class="footer-link">Reviews</a>
        <a href="#contact" class="footer-link">Contact</a>
      </div>
      <div class="footer-col">
        <h4 class="footer-col-title">Contact & Location</h4>
        <span class="footer-info-item">128 Artisan Street, Suite 400</span>
        <span class="footer-info-item">hello@${esc(brandName.toLowerCase().replace(/\s+/g, ''))}.com</span>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="footer-copy">${esc(text)}</div>
    </div>
  </footer>`;
}

function renderBrandStatement(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const sectionNum = p.number || '02';
  const label = p.label || 'WHY WE EXIST';
  const headline = p.headline || p.title || 'We exist to keep you at your peak, reimagining IV therapy into a portable drink that fuels performance, supports recovery, and keeps you sharp. Every day.';
  const subtitle = p.subtitle || p.subtext || 'Science-backed fluids. Real-world performance. Find out how we keep you operating at your peak.';
  const cta = p.cta || 'Discover our approach';
  const ctaUrl = p.ctaUrl || '#about';

  return `<section class="section-container node-${node.id} brand-statement-section" id="about">
    <div class="editorial-meta-header">
      <span class="meta-num">${esc(sectionNum)} /</span>
      <span class="meta-label">${esc(label)}</span>
    </div>
    <h2 class="editorial-statement-title">${esc(headline)}</h2>
    <p class="editorial-statement-desc">${esc(subtitle)}</p>
    ${cta ? `<div style="margin-top: 32px;"><a href="${esc(ctaUrl)}" class="btn btn-secondary">${esc(cta)} &rarr;</a></div>` : ''}
  </section>`;
}

function renderScienceGrid(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const sectionNum = p.number || '03';
  const label = p.label || 'THE SCIENCE';
  const title = p.title || 'Drinkable IV Formula™';
  const items = p.items || [
    { num: '001', title: 'IV-Inspired, Everyday Ready', desc: 'Each formula mirrors the nutrient profile of popular IV vitamin therapies in a practical format.' },
    { num: '002', title: 'Quality Ingredients, Better Absorption', desc: 'Every vitamin, mineral, and antioxidant is intentionally selected for superior bioavailability.' },
    { num: '003', title: 'Targeted Wellness Solutions', desc: 'Formulated to target distinct areas of health, ensuring optimal performance support.' },
    { num: '004', title: 'Clean Label, Modern Formulas', desc: 'Vegan, gluten free, non-GMO, and made without artificial sweeteners or sugar.' }
  ];

  const cardsHtml = items.map((item: any) => `
    <div class="science-card">
      <span class="science-card-num">${esc(item.num || '001')}</span>
      <h3 class="science-card-title">${esc(item.title)}</h3>
      <p class="science-card-desc">${esc(item.desc)}</p>
    </div>
  `).join('');

  return `<section class="section-container node-${node.id} science-section">
    <div class="editorial-meta-header">
      <span class="meta-num">${esc(sectionNum)} /</span>
      <span class="meta-label">${esc(label)}</span>
    </div>
    <h2 class="section-title text-left">${esc(title)}</h2>
    <div class="science-grid">
      ${cardsHtml}
    </div>
  </section>`;
}

function renderExpertProof(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const sectionNum = p.number || '04';
  const label = p.label || 'MEDICALLY SUPPORTED';
  const quote = p.quote || 'POUCH reimagines the benefits of IV therapy in an oral, fast-absorbing format. It delivers highly bioavailable nutrients that fuel cellular health, support hydration, and enhance cognitive performance.';
  const author = p.author || 'Brooke Aaron, MS, RDN, LDN';
  const leftImg = p.leftImg || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
  const avatarImg = p.avatarImg || 'https://images.unsplash.com/photo-1594824813571-2153349aed06?auto=format&fit=crop&w=200&q=80';

  return `<section class="section-container node-${node.id} pouch-expert-section">
    <div class="editorial-meta-header" style="margin-bottom: 24px;">
      <span class="meta-num">${esc(sectionNum)} /</span>
      <span class="meta-label">${esc(label)}</span>
    </div>
    <div class="pouch-expert-card">
      <div class="pouch-expert-left">
        <img src="${esc(leftImg)}" alt="Athletic Performance" class="pouch-expert-img" />
        <div class="pouch-expert-left-overlay">
          <span class="pouch-expert-overlay-title">ALL FORMULAS ARE:</span>
          <ul class="pouch-expert-overlay-list">
            <li>01 / NON-GMO</li>
            <li>02 / GLUTEN FREE</li>
            <li>03 / VEGAN</li>
            <li>04 / ZERO SUGAR</li>
            <li>05 / NO ARTIFICIAL SWEETENERS</li>
          </ul>
        </div>
      </div>
      <div class="pouch-expert-right">
        <div class="pouch-expert-avatar-box">
          <img src="${esc(avatarImg)}" alt="${esc(author)}" class="pouch-expert-avatar-img" />
        </div>
        <blockquote class="pouch-expert-quote">
          "${esc(quote)}"
        </blockquote>
        <div class="pouch-expert-author">
          ${esc(author.toUpperCase())}
        </div>
        <div class="pouch-expert-cta">
          <a href="#products" class="btn btn-pouch-blue">EXPLORE OUR FORMULAS &rarr;</a>
        </div>
      </div>
    </div>
  </section>`;
}

function renderComparisonSection(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const sectionNum = p.number || '07';
  const label = p.label || 'SIP VS DRIP';
  const title = p.title || 'Oral Bioavailability vs IV Infusion';

  return `<section class="section-container node-${node.id} comparison-section">
    <div class="editorial-meta-header">
      <span class="meta-num">${esc(sectionNum)} /</span>
      <span class="meta-label">${esc(label)}</span>
    </div>
    <h2 class="section-title text-left">${esc(title)}</h2>
    <div class="comparison-grid">
      <div class="comparison-col sip-col">
        <div class="comp-header">
          <span class="comp-badge">DAILY FORMULA</span>
          <h3>SIP (POUCH)</h3>
        </div>
        <ul class="comp-list">
          <li>✓ Daily, portable & convenient</li>
          <li>✓ Bioavailable marine minerals & glutathione</li>
          <li>✓ Zero needles or clinical downtime</li>
          <li>✓ Safe, consistent cellular nourishment</li>
          <li>✓ Affordable daily habit</li>
        </ul>
      </div>
      <div class="comparison-col drip-col">
        <div class="comp-header">
          <span class="comp-badge">CLINICAL</span>
          <h3>DRIP (IV)</h3>
        </div>
        <ul class="comp-list">
          <li>✕ Invasive needle insertion</li>
          <li>✕ High cost ($150–$300 per session)</li>
          <li>✕ Requires 60+ min clinic visit</li>
          <li>✕ Risk of fluid overload with daily use</li>
          <li>✕ Impractical for everyday routine</li>
        </ul>
      </div>
    </div>
  </section>`;
}

function renderFaqAccordion(node: UINode, template: string = '', variant: string = ''): string {
  const p = node.props;
  const sectionNum = p.number || '08';
  const label = p.label || 'FAQS';
  const title = p.title || 'Frequently Asked Questions';
  const faqs = p.items || p.faqs || [
    { q: 'How often can I drink POUCH products?', a: 'We recommend one POUCH daily for WellDrip+, SkinRevive+, and Immunity+. Hydration+ can be enjoyed 1–2 times daily.' },
    { q: 'Do POUCH products need to be refrigerated?', a: 'No. POUCH products are shelf-stable. While refrigeration is not required, we recommend enjoying them chilled.' },
    { q: 'Are POUCH formulas third-party tested?', a: 'Yes. All POUCH formulas are third-party tested for heavy metals, potency, and shelf stability.' },
    { q: 'How can a drinkable product compare to IV therapy?', a: 'POUCH mirrors the nutrient profiles and bioavailable ingredients of IV therapy in an oral, daily-ready format.' }
  ];

  const accordionHtml = faqs.map((faq: any, i: number) => `
    <details class="faq-details" ${i === 0 ? 'open' : ''}>
      <summary class="faq-summary">
        <span class="faq-question">${esc(faq.q)}</span>
        <span class="faq-icon">+</span>
      </summary>
      <div class="faq-answer">
        <p>${esc(faq.a)}</p>
      </div>
    </details>
  `).join('');

  return `<section class="section-container node-${node.id} faq-section" id="faqs">
    <div class="editorial-meta-header">
      <span class="meta-num">${esc(sectionNum)} /</span>
      <span class="meta-label">${esc(label)}</span>
    </div>
    <h2 class="section-title text-left">${esc(title)}</h2>
    <div class="faq-accordion-list">
      ${accordionHtml}
    </div>
  </section>`;
}

const RENDERERS: Record<string, (node: UINode) => string> = {
  announcement_bar: renderAnnouncementBar,
  hero: renderHeroBanner,
  hero_banner: renderHeroBanner,
  product_grid: renderProductGrid,
  menu_grid: renderProductGrid,
  service_list: renderServiceList,
  testimonials: renderTestimonials,
  testimonial: renderTestimonials,
  contact_form: renderContactForm,
  hours: renderHours,
  footer: renderFooter,
  brand_statement: renderBrandStatement,
  statement_banner: renderBrandStatement,
  science_grid: renderScienceGrid,
  feature_matrix: renderScienceGrid,
  expert_proof: renderExpertProof,
  sip_vs_drip: renderComparisonSection,
  comparison_table: renderComparisonSection,
  faq_accordion: renderFaqAccordion,
  faqs: renderFaqAccordion,
};

function renderNode(node: UINode, template: string = ''): string {
  const variant = node.variant || node.layout || '';
  const raw = node.props || {};

  // Normalise all AI field aliases into canonical {{placeholder}} names
  // so the .md HTML contracts always resolve correctly.
  const props: Record<string, any> = {
    ...raw,
    // title / headline / body
    title:    raw.title    || raw.headline   || raw.heading || raw.name || 'Dress for major focus.',
    subtitle: raw.subtitle || raw.subtext    || raw.desc    || raw.text || raw.body || 'Lightweight, breathable golf styles that never get in the way of your swing.',
    body:     raw.body     || raw.subtitle   || raw.subtext || raw.desc || 'Technical gear built to stand up to heavy sweat sessions while maintaining pure everyday elegance.',
    eyebrow:  raw.eyebrow  || 'OUR STORY',
    // hero / section CTAs
    ctaText:  raw.ctaText  || raw.cta        || raw.buttonText || raw.submit_label || "Shop Women's Golf",
    ctaUrl:   raw.ctaUrl   || raw.link       || raw.href    || '#',
    cta2Text: raw.cta2Text || raw.secondaryCtaText || raw.altCta || "Shop Men's Golf",
    cta2Url:  raw.cta2Url  || raw.secondaryCtaUrl  || '#',
    // image with high-converting Unsplash activewear fallbacks
    image:              raw.image || raw.imageUrl || raw.bgImage || raw.bg || 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=1600&q=80',
    women_image:        raw.women_image || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
    men_image:          raw.men_image || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    new_image:          raw.new_image || 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    yoga_image:         raw.yoga_image || 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=600&q=80',
    run_image:          raw.run_image || 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=600&q=80',
    train_image:        raw.train_image || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
    cycle_image:        raw.cycle_image || 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
    hike_image:         raw.hike_image || 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=80',
    golf_image:         raw.golf_image || 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=80',
    // year for footer
    year: new Date().getFullYear(),
  };

  // Ensure product_grid items has complete 5-item mock data with images and swatches if sparse
  if (node.type === 'product_grid' || node.type === 'menu_grid') {
    const rawItems = Array.isArray(raw.items) && raw.items.length >= 4 ? raw.items : [
      {
        name: 'Grand Standard Short-Sleeve Polo',
        price: 88,
        image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80',
        hoverImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
        colors: [{ hex: '#111111' }, { hex: '#4a5568' }, { hex: '#cbd5e0' }]
      },
      {
        name: 'Unshaken Relaxed-Fit Pant *Regular',
        price: 118,
        image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=600&q=80',
        hoverImage: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=600&q=80',
        colors: [{ hex: '#d4b185' }, { hex: '#111111' }, { hex: '#718096' }],
        moreColors: 2
      },
      {
        name: 'Sleeveless Golf Polo Dress',
        price: 128,
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
        hoverImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80',
        colors: [{ hex: '#f7fafc' }, { hex: '#2f855a' }]
      },
      {
        name: "Men's ShowZero™ Classic-Fit Polo Shirt",
        price: 78,
        image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=600&q=80',
        hoverImage: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
        colors: [{ hex: '#ebf8ff' }, { hex: '#2b6cb0' }, { hex: '#111111' }]
      },
      {
        name: 'Lightweight High-Neck Vest *Graphic',
        price: 98,
        image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
        hoverImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
        colors: [{ hex: '#276749' }, { hex: '#111111' }]
      }
    ];

    props.items = rawItems.map((item: any, i: number) => ({
      name: item.name || item.title || `Performance Activewear Style ${i + 1}`,
      price: item.price || 88 + i * 10,
      image: item.image || item.imageUrl || `https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=600&q=80`,
      hoverImage: item.hoverImage || item.image || `https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80`,
      colors: Array.isArray(item.colors) ? item.colors : [{ hex: '#111111' }, { hex: '#718096' }],
      moreColors: item.moreColors || undefined
    }));
  }

  // ── Method B: Pure .md contract rendering ────────────────────────────────
  const activeTemplate = template || 'lululemon';
  const specs = getDesignSections(activeTemplate);
  const sectionResult = renderFromSpec(node.type, props, specs);

  if (sectionResult && sectionResult.html) {
    return `<style>${sectionResult.css}</style>\n${sectionResult.html}`;
  }

  // Fallback to generic contract rendering if section spec is missing
  return renderGenericDynamicNode(node);
}

function renderGenericDynamicNode(node: UINode): string {
  const p = node.props || {};
  const css = cssToInline(node.css || {});
  const title = p.title || p.headline || p.name || '';
  const subtitle = p.subtitle || p.subtext || p.desc || p.description || '';
  const items = p.items || p.cards || p.list || [];
  const cta = p.cta || p.ctaText || p.buttonText || '';
  const ctaUrl = p.ctaUrl || p.link || '#';
  const imgUrl = p.image || p.imageUrl || p.bgImage || '';

  let childrenHtml = '';
  if (node.children && node.children.length > 0) {
    childrenHtml = node.children.map(child => renderNode(child)).join('\n');
  }

  let itemsHtml = '';
  if (Array.isArray(items) && items.length > 0) {
    const cards = items.map((item: any) => {
      if (typeof item === 'string') return `<div class="dynamic-card"><p>${esc(item)}</p></div>`;
      const itemTitle = item.title || item.name || item.heading || '';
      const itemDesc = item.desc || item.description || item.text || '';
      const itemBadge = item.badge || item.tag || '';
      const itemImg = item.image || item.imageUrl || '';
      return `<div class="dynamic-card">
        ${itemImg ? `<img src="${esc(itemImg)}" alt="${esc(itemTitle)}" class="dynamic-card-img" />` : ''}
        ${itemBadge ? `<span class="pill-badge">${esc(itemBadge)}</span>` : ''}
        ${itemTitle ? `<h3 class="dynamic-card-title">${esc(itemTitle)}</h3>` : ''}
        ${itemDesc ? `<p class="dynamic-card-desc">${esc(itemDesc)}</p>` : ''}
      </div>`;
    }).join('\n');
    itemsHtml = `<div class="dynamic-grid">${cards}</div>`;
  }

  return `<section class="section-container node-${node.id} dynamic-section section-${node.type}" style="${css}">
    ${title || subtitle ? `<div class="section-header-box text-left">
      ${title ? `<h2 class="section-title text-left">${esc(title)}</h2>` : ''}
      ${subtitle ? `<p class="section-subtitle">${esc(subtitle)}</p>` : ''}
    </div>` : ''}
    ${imgUrl ? `<div class="dynamic-media-box"><img src="${esc(imgUrl)}" alt="${esc(title)}" class="dynamic-img" /></div>` : ''}
    ${itemsHtml}
    ${childrenHtml}
    ${cta ? `<div style="margin-top: 32px;"><a href="${esc(ctaUrl)}" class="btn btn-primary">${esc(cta)} &rarr;</a></div>` : ''}
  </section>`;
}

// ── Main Page Builder ─────────────────────────────────────────────

interface RenderOptions {
  plan: SiteLayout;
  tokens: {
    colors: Record<string, string>;
    typography: Record<string, any>;
    rounded: Record<string, string>;
    spacing: Record<string, string>;
  };
  workspaceName: string;
}

export function renderSectionsToHtml(options: RenderOptions): string {
  const { plan, tokens, workspaceName } = options;
  const { colors } = tokens;

  // Normalize sections
  let nodes: UINode[] = [];
  if ((plan as any).sections && Array.isArray((plan as any).sections)) {
    nodes = (plan as any).sections.map((sec: any, idx: number) => ({
      id: `sec_${idx}_${sec.type}`,
      type: sec.type,
      props: { ...sec, ...(sec.config || {}), workspaceName },
    }));
  } else if (plan.routes && plan.routes[0] && Array.isArray(plan.routes[0].nodes)) {
    nodes = plan.routes[0].nodes;
  }

  if (!nodes || nodes.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;"><h1>${esc(workspaceName)}</h1><p>Website configuration loading...</p></body></html>`;
  }

  // Pure Open AI Theme Resolution
  const planTheme = (plan as any).theme || {};

  const activePrimary = planTheme.primary || colors.primary || '#18181B';
  const activeSecondary = planTheme.secondary || colors.secondary || '#475569';
  const activeBg = planTheme.background || colors.background || '#F8FAFC';
  const activeSurface = planTheme.surface || colors.surface || '#FFFFFF';
  const activeText = planTheme.text || colors.text || '#0F172A';
  const fontBody = planTheme.font || 'Inter';
  const fontHeading = planTheme.fontHeading || 'Outfit';

  const primaryRgb = hexToRgb(activePrimary);
  const isDarkBg = activeBg === '#09090B' || activeBg === '#0F172A' || activeBg === '#111827' || activeBg === '#141417';

  // Render Header Nav + Section Nodes
  const templateName = (plan as any).template || '';
  const mdSections = getDesignSections(templateName);
  const hasMdSpec = Object.keys(mdSections).length > 0;

  // Pure Method B rendering: render layout nodes directly from specs
  const headerHtml = hasMdSpec ? '' : renderHeaderNav(workspaceName, templateName);
  const contentHtml = nodes
    .map(node => renderNode(node, templateName))
    .filter(html => html.length > 0)
    .join('\n');

  const mediaQueries: string[] = [];
  for (const node of nodes) {
    const mq = generateMediaQueries(node);
    if (mq) mediaQueries.push(mq);
  }

  // Premium Framer & Webflow Quality CSS System
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap');

    :root {
      --primary: ${activePrimary};
      --primary-rgb: ${primaryRgb};
      --secondary: ${activeSecondary};
      --bg: ${activeBg};
      --surface: ${activeSurface};
      --surface-border: ${isDarkBg ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'};
      --text: ${activeText};
      --text-muted: ${isDarkBg ? 'rgba(250, 250, 250, 0.65)' : 'rgba(28, 25, 23, 0.62)'};
      --font-body: '${fontBody}', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-heading: '${fontHeading}', var(--font-body);
      --radius-card: 16px;
      --radius-btn: 10px;
      --shadow-card: ${isDarkBg ? '0 12px 30px -10px rgba(0,0,0,0.5)' : '0 12px 30px -10px rgba(0,0,0,0.06)'};
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4 {
      font-family: var(--font-heading);
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: var(--text);
    }

    /* Lululemon UK Top Bar & Header */
    .lulu-top-announcement {
      background: #f7f7f7;
      color: #111111;
      font-size: 0.8rem;
      font-weight: 500;
      text-align: center;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-bottom: 1px solid #e5e5e5;
    }
    .lulu-top-announcement a { color: #111111; text-decoration: underline; font-weight: 600; }
    .lulu-arrow { font-family: monospace; opacity: 0.6; cursor: pointer; }
    .lulu-header {
      background: #ffffff;
      border-bottom: 1px solid #e5e5e5;
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 12px 32px;
    }
    .lulu-header-inner {
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .lulu-brand { display: flex; align-items: center; gap: 8px; }
    .lulu-wordmark { font-size: 1.5rem; font-weight: 800; color: #111111; letter-spacing: -0.03em; }
    .lulu-nav-menu { display: flex; align-items: center; gap: 24px; }
    .lulu-nav-link { font-size: 0.95rem; font-weight: 700; color: #111111; text-decoration: none; position: relative; }
    .lulu-nav-link.active::after { content: ''; position: absolute; bottom: -14px; left: 0; right: 0; height: 3px; background: #D31334; }
    .lulu-header-actions { display: flex; align-items: center; gap: 16px; }
    .lulu-search-box {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #111111;
      border-radius: 9999px;
      padding: 6px 16px;
      gap: 8px;
      width: 220px;
    }
    .lulu-search-input { border: none; outline: none; background: transparent; font-size: 0.85rem; width: 100%; }
    .lulu-region-select { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 600; color: #111111; }
    .lulu-user-icon, .lulu-bag-icon { font-size: 1.2rem; text-decoration: none; }

    /* Lululemon Hero Section */
    .lulu-hero-section {
      position: relative;
      min-height: 85vh;
      display: flex;
      align-items: flex-end;
      padding: 60px 48px;
      overflow: hidden;
      color: #ffffff;
    }
    .lulu-hero-bg {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-size: cover;
      background-position: center;
    }
    .lulu-hero-container {
      position: relative;
      z-index: 10;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }
    .lulu-hero-title { font-size: 4rem; font-weight: 800; color: #ffffff; margin-bottom: 16px; line-height: 1.05; letter-spacing: -0.03em; }
    .lulu-hero-subtitle { font-size: 1.25rem; font-weight: 400; color: rgba(255,255,255,0.9); max-width: 680px; margin-bottom: 32px; line-height: 1.4; }
    .lulu-hero-cta-box { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .btn-lulu-pill {
      background: #ffffff;
      color: #111111;
      font-size: 0.95rem;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 9999px;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s;
    }
    .btn-lulu-pill:hover { background: #f0f0f0; transform: translateY(-1px); }
    .lulu-hero-controls { display: flex; align-items: center; gap: 10px; }
    .lulu-ctrl-btn {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      backdrop-filter: blur(8px);
    }

    /* Pouch Floating Pill Header */
    .pouch-header {
      position: absolute;
      top: 36px;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 0 40px;
    }
    .pouch-header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .pouch-brand-logo {
      font-family: var(--font-heading);
      font-size: 2.5rem;
      font-weight: 800;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: 0.05em;
      text-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .pouch-pill-nav, .pouch-pill-actions {
      background: rgba(237, 235, 228, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 10px;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .pouch-nav-link, .pouch-action-link, .pouch-bag-link {
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: 500;
      color: #01273e;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: opacity 0.2s;
    }
    .pouch-nav-link:hover, .pouch-action-link:hover { opacity: 0.7; }
    .pouch-bag-link { font-weight: 700; }

    /* Pouch Fullscreen Atmospheric Hero */
    .pouch-hero-section {
      position: relative;
      min-height: 88vh;
      display: flex;
      align-items: flex-end;
      padding: 140px 40px 80px 40px;
      background-color: #01273e;
      overflow: hidden;
    }
    .pouch-hero-bg {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-size: cover;
      background-position: center;
      z-index: 1;
    }
    .pouch-hero-container {
      position: relative;
      z-index: 2;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
    }
    .pouch-hero-content {
      max-width: 750px;
    }
    .pouch-hero-title {
      font-family: var(--font-heading);
      font-size: clamp(3rem, 6.5vw, 5.5rem);
      font-weight: 400;
      color: #ffffff;
      line-height: 1.05;
      margin-bottom: 24px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .pouch-hero-subtitle {
      font-size: clamp(1.1rem, 2vw, 1.35rem);
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.4;
      margin-bottom: 36px;
      max-width: 580px;
      font-family: var(--font-body);
    }
    .btn-pouch-blue {
      background: #000bfa;
      color: #ffffff;
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 16px 36px;
      border-radius: 8px;
      letter-spacing: 0.05em;
      text-decoration: none;
      display: inline-block;
      box-shadow: 0 10px 30px rgba(0, 11, 250, 0.4);
      transition: all 0.25s ease;
    }
    .btn-pouch-blue:hover {
      background: #0008ad;
      transform: translateY(-2px);
      box-shadow: 0 14px 35px rgba(0, 11, 250, 0.5);
    }

    /* Top Navigation Header */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: ${isDarkBg ? 'rgba(15, 23, 42, 0.85)' : 'rgba(250, 247, 245, 0.88)'};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--surface-border);
      padding: 16px 24px;
    }
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand-logo {
      font-family: var(--font-heading);
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .nav-menu {
      display: flex;
      align-items: center;
      gap: 32px;
    }
    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .nav-link:hover {
      color: var(--primary);
    }
    .nav-cta {
      padding: 10px 20px;
      font-size: 0.88rem;
    }

    /* Announcement Bar (Marquee Loop) */
    .announcement-bar {
      background: var(--primary);
      color: #FFFFFF;
      padding: 8px 0;
      font-size: 0.85rem;
      font-weight: 500;
      overflow: hidden;
      white-space: nowrap;
      text-transform: uppercase;
      font-family: monospace;
    }
    marquee-loop {
      display: block;
      position: relative;
      user-select: none;
    }
    marquee-loop .track {
      display: flex;
      width: max-content;
      animation: marquee-scroll 15s linear infinite;
    }
    marquee-loop .slide {
      flex: 0 0 auto;
    }
    @keyframes marquee-scroll {
      0% { transform: translate(0); }
      100% { transform: translate(-50%); }
    }

    /* Hero Section (2-Column Split) */
    .hero-section {
      padding: 90px 24px;
      overflow: hidden;
    }
    .hero-container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      align-items: center;
    }
    .hero-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(var(--primary-rgb), 0.1);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(var(--primary-rgb), 0.2);
      border-radius: 99px;
      font-size: 0.6875rem;
      font-family: monospace;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--primary);
      margin-bottom: 24px;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
    }
    .hero-title {
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 800;
      margin-bottom: 20px;
      line-height: 1.12;
    }
    .hero-subtitle {
      font-size: clamp(1.05rem, 2vw, 1.25rem);
      color: var(--text-muted);
      margin-bottom: 36px;
      max-width: 540px;
    }
    .hero-cta-group {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }
    .hero-media {
      position: relative;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15);
      aspect-ratio: 4/3;
    }
    .hero-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 28px;
      border-radius: var(--radius-btn);
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.25s ease;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 6px 20px -4px rgba(var(--primary-rgb), 0.35);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -4px rgba(var(--primary-rgb), 0.45);
    }
    .btn-secondary {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--surface-border);
    }
    .btn-secondary:hover {
      background: rgba(var(--primary-rgb), 0.06);
    }
    .btn-full { width: 100%; }

    /* Section Containers */
    .section-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 80px 24px;
    }
    .section-header-box {
      text-align: center;
      margin-bottom: 54px;
    }
    .section-title {
      font-size: clamp(2rem, 3.5vw, 2.75rem);
      font-weight: 800;
      margin-bottom: 12px;
    }
    .section-subtitle {
      font-size: 1.1rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
    }

    /* Pouch Formula Product Cards */
    .pouch-product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 32px;
      margin-top: 40px;
    }
    .pouch-product-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .pouch-product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
    }
    .pouch-card-image-box {
      aspect-ratio: 4/3;
      position: relative;
      background: #edebe4;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .pouch-card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    .pouch-product-card:hover .pouch-card-img {
      transform: scale(1.04);
    }
    .pouch-card-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      font-family: monospace;
      font-size: 0.6875rem;
      text-transform: uppercase;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      color: #01273e;
    }
    .pouch-card-content {
      padding: 24px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .pouch-card-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .pouch-flavor-name {
      font-family: monospace;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--primary);
      font-weight: 600;
    }
    .pouch-volume-tag {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .pouch-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 6px;
    }
    .pouch-product-name {
      font-family: var(--font-heading);
      font-size: 1.4rem;
      font-weight: 700;
    }
    .pouch-product-price {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary);
    }
    .pouch-formula-sub {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .pouch-card-nutrition {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .pouch-card-tag {
      font-family: monospace;
      font-size: 0.6875rem;
      background: rgba(0, 11, 250, 0.08);
      color: #000bfa;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 700;
    }
    .pouch-card-ingredients {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: auto;
    }
    .pouch-card-ing {
      font-family: monospace;
      font-size: 0.6875rem;
      background: rgba(0, 0, 0, 0.04);
      color: var(--text-muted);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .product-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-card);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-card);
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.12);
    }
    .product-img-box {
      aspect-ratio: 4/3;
      position: relative;
      overflow: hidden;
      background: rgba(0,0,0,0.04);
    }
    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    .product-card:hover .product-img {
      transform: scale(1.03);
    }
    .product-card-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      color: var(--text);
      font-size: 0.6875rem;
      font-family: monospace;
      text-transform: uppercase;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .product-card-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .product-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
    }
    .product-title {
      font-size: 1.2rem;
      font-weight: 700;
    }
    .product-price {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary);
    }
    .product-desc {
      font-size: 0.92rem;
      color: var(--text-muted);
      margin-bottom: 20px;
      flex: 1;
      line-height: 1.5;
    }
    .product-card-footer {
      margin-top: auto;
    }
    .btn-card-action {
      width: 100%;
      background: var(--primary);
      color: #ffffff;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .btn-card-action:hover { opacity: 0.9; }

    /* Service Grid */
    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 28px;
    }
    .service-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-card);
      padding: 32px;
      box-shadow: var(--shadow-card);
    }
    .service-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .service-num {
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--primary);
      background: rgba(var(--primary-rgb), 0.1);
      padding: 4px 10px;
      border-radius: 6px;
    }
    .service-title { font-size: 1.25rem; font-weight: 700; }
    .service-desc { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 16px; }
    .service-price { font-weight: 800; color: var(--primary); font-size: 1.1rem; }

    /* Testimonial Grid */
    .testimonial-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 28px;
    }
    .testimonial-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-card);
      padding: 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: var(--shadow-card);
    }
    .star-rating { color: #F59E0B; font-size: 1.1rem; letter-spacing: 2px; }
    .testimonial-quote { font-size: 1rem; font-style: italic; line-height: 1.6; flex: 1; color: var(--text); }
    .testimonial-author-box { display: flex; align-items: center; gap: 14px; margin-top: auto; }
    .author-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--primary);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .author-name { font-weight: 700; font-size: 0.98rem; }
    .author-role { font-size: 0.82rem; color: var(--text-muted); }

    /* Contact Card */
    .contact-card {
      max-width: 720px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-card);
      padding: 48px 40px;
      box-shadow: var(--shadow-card);
    }
    .contact-form { display: flex; flex-direction: column; gap: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 0.88rem; font-weight: 600; color: var(--text); }
    .form-input {
      background: var(--bg);
      border: 1px solid var(--surface-border);
      border-radius: 10px;
      padding: 14px 16px;
      color: var(--text);
      font-size: 0.95rem;
      font-family: inherit;
    }
    .form-input:focus {
      outline: 2px solid var(--primary);
    }

    /* Hours Card */
    .hours-card {
      max-width: 640px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-card);
      padding: 40px;
      text-align: center;
      box-shadow: var(--shadow-card);
    }
    .hours-title { font-size: 1.35rem; margin-bottom: 12px; font-weight: 700; }
    .hours-text { font-size: 1.1rem; color: var(--text-muted); }

    /* Footer */
    .site-footer {
      border-top: 1px solid var(--surface-border);
      background: var(--surface);
      padding: 60px 24px 30px;
    }
    .footer-container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 48px;
      margin-bottom: 40px;
    }
    .footer-brand { font-size: 1.35rem; font-weight: 800; margin-bottom: 10px; }
    .footer-tagline { color: var(--text-muted); font-size: 0.92rem; max-width: 320px; }
    .footer-col { display: flex; flex-direction: column; gap: 10px; }
    .footer-col-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 6px; }
    .footer-link { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; transition: color 0.2s ease; }
    .footer-link:hover { color: var(--primary); }
    .footer-info-item { color: var(--text-muted); font-size: 0.9rem; }
    .footer-bottom {
      max-width: 1200px;
      margin: 0 auto;
      border-top: 1px solid var(--surface-border);
      padding-top: 24px;
      text-align: center;
    }
    .footer-copy { font-size: 0.85rem; color: var(--text-muted); }

    @media (max-width: 768px) {
      .hero-container { grid-template-columns: 1fr; gap: 36px; }
      .nav-menu { display: none; }
      .form-row { grid-template-columns: 1fr; }
      .footer-container { grid-template-columns: 1fr; gap: 32px; }
    }

    ${mediaQueries.join('\n')}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(workspaceName)}</title>
  <style>
    ${styles}

    /* Editorial Meta Headers */
    .editorial-meta-header {
      font-family: monospace;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .meta-num { font-weight: 700; }
    .meta-label { letter-spacing: 0.05em; color: var(--text-muted); }

    .editorial-statement-title {
      font-size: clamp(2.2rem, 4vw, 3.5rem);
      line-height: 1.18;
      font-family: var(--font-heading);
      max-width: 900px;
      margin-bottom: 24px;
    }
    .editorial-statement-desc {
      font-size: 1.2rem;
      color: var(--text-muted);
      max-width: 680px;
    }

    /* Mono Ribbon Pills */
    .badge-ribbon-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 40px;
    }
    .mono-pill {
      font-family: monospace;
      font-size: 0.75rem;
      text-transform: uppercase;
      background: rgba(var(--primary-rgb), 0.08);
      border: 1px solid rgba(var(--primary-rgb), 0.15);
      padding: 6px 14px;
      border-radius: 6px;
      color: var(--text);
    }

    /* Science Section Grid */
    .science-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 32px;
      margin-top: 40px;
    }
    .science-card {
      border-top: 1px solid var(--surface-border);
      padding-top: 24px;
    }
    .science-card-num {
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--primary);
      display: block;
      margin-bottom: 12px;
    }
    .science-card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .science-card-desc {
      font-size: 0.95rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Pouch 2-Column Expert Testimonial Section */
    .pouch-expert-section {
      padding: 60px 24px;
    }
    .pouch-expert-card {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05);
    }
    @media(max-width: 900px) {
      .pouch-expert-card { grid-template-columns: 1fr; }
    }
    .pouch-expert-left {
      position: relative;
      min-height: 480px;
      background: #01273e;
    }
    .pouch-expert-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pouch-expert-left-overlay {
      position: absolute;
      bottom: 36px;
      left: 36px;
      right: 36px;
      color: #ffffff;
      z-index: 2;
    }
    .pouch-expert-overlay-title {
      font-family: monospace;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.85;
      display: block;
      margin-bottom: 14px;
    }
    .pouch-expert-overlay-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .pouch-expert-right {
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #f7f6f6;
    }
    .pouch-expert-avatar-box {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    }
    .pouch-expert-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pouch-expert-quote {
      font-family: var(--font-heading);
      font-size: clamp(1.3rem, 2.2vw, 1.8rem);
      line-height: 1.35;
      color: #01273e;
      margin-bottom: 24px;
    }
    .pouch-expert-author {
      font-family: monospace;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 36px;
    }
    .pouch-expert-cta {
      margin-top: auto;
    }
      padding: 24px;
      display: flex;
      flex-direction: column;
      font-size: 1.1rem;
    }
    .benefit-tile span { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; font-family: monospace; }
    .benefit-tile strong { font-size: 1.5rem; font-family: var(--font-heading); }

    /* Sip vs Drip Comparison */
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 40px;
    }
    @media(max-width: 768px) {
      .comparison-grid { grid-template-columns: 1fr; }
    }
    .comparison-col {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 36px;
    }
    .sip-col { border-color: var(--primary); }
    .comp-header { margin-bottom: 24px; }
    .comp-badge { font-family: monospace; font-size: 0.72rem; padding: 4px 8px; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); border-radius: 4px; }
    .comp-header h3 { font-size: 1.8rem; margin-top: 8px; }
    .comp-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
    .comp-list li { font-size: 0.98rem; }

    /* FAQ Accordion */
    .faq-accordion-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 40px;
    }
    .faq-details {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 24px;
    }
    .faq-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      font-size: 1.15rem;
      font-weight: 700;
      list-style: none;
    }
    .faq-summary::-webkit-details-marker { display: none; }
    .faq-icon { font-size: 1.4rem; color: var(--primary); font-family: monospace; }
    /* Pouch Newsletter Section */
    .pouch-newsletter-section {
      background: #01273e;
      padding: 100px 24px;
      color: #ffffff;
    }
    .pouch-newsletter-box {
      max-width: 680px;
      margin: 0 auto;
      text-align: center;
    }
    .pouch-newsletter-title {
      font-family: var(--font-heading);
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 400;
      color: #ffffff;
      margin-bottom: 16px;
    }
    .pouch-newsletter-sub {
      font-size: 1.05rem;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 40px;
      line-height: 1.5;
    }
    .pouch-newsletter-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pouch-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .pouch-form-inline {
      display: flex;
      gap: 12px;
    }
    .pouch-input {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 12px;
      padding: 16px 20px;
      color: #ffffff;
      font-family: monospace;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      width: 100%;
    }
    .pouch-input::placeholder {
      color: rgba(255, 255, 255, 0.6);
      font-family: monospace;
    }
    .pouch-checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: monospace;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.85);
      margin-top: 12px;
      cursor: pointer;
      justify-content: center;
    }
    /* Pouch Community Reviews */
    .pouch-reviews-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 28px;
      margin-top: 40px;
    }
    .pouch-review-card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 24px rgba(0,0,0,0.04);
    }
    .pouch-review-stars {
      color: #000bfa;
      font-size: 1.1rem;
      margin-bottom: 16px;
      letter-spacing: 2px;
    }
    .pouch-review-quote {
      font-family: var(--font-heading);
      font-size: 1.15rem;
      line-height: 1.5;
      color: #01273e;
      margin-bottom: 20px;
      flex: 1;
    }
    .pouch-review-author-box {
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--surface-border);
      padding-top: 16px;
    }
    .pouch-review-author {
      font-family: monospace;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: #01273e;
    }
    .pouch-review-role {
      font-family: monospace;
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* Pouch Footer */
    .pouch-footer {
      background: #011f32;
      color: #ffffff;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .pouch-footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      max-width: 1400px;
      margin: 0 auto;
    }
    @media(max-width: 768px) {
      .pouch-footer-grid { grid-template-columns: 1fr; }
    }
    .pouch-footer-col {
      padding: 48px 36px;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .pouch-footer-col:last-child { border-right: none; }
    .pouch-footer-col-header {
      font-family: monospace;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 12px;
    }
    .pouch-footer-link {
      color: #ffffff;
      text-decoration: none;
      font-size: 0.95rem;
      font-family: var(--font-body);
      transition: opacity 0.2s;
    }
    .pouch-footer-link:hover { opacity: 0.7; }

    .pouch-footer-bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      max-width: 1400px;
      margin: 0 auto;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px 36px;
      font-family: monospace;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 0.05em;
    }
    @media(max-width: 768px) {
      .pouch-footer-bottom-grid { grid-template-columns: 1fr; gap: 12px; }
    }
    .text-right { text-align: right; }
  </style>
</head>
<body>
  ${headerHtml}
  ${contentHtml}
</body>
</html>`;
}
