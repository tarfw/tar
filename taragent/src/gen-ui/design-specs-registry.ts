/**
 * Design Specs Registry — Method B Open Design Engine
 *
 * Each .md file is embedded here as a raw string.
 * `getDesignSpec()` returns parsed color/typography tokens.
 * `getSectionSpecs()` returns the parsed HTML+CSS section contracts.
 */

import { parseDesignMD, type DesignTokens } from '../lib/design-md-parser';
import { parseSectionSpecs, type SectionSpec } from './md-section-parser';

// ─── Embedded .md files ──────────────────────────────────────────────────────
// These mirror exactly what is in docs/DESIGN-*.md
// The renderer reads HTML contracts + CSS rules directly from these strings.

export const LULULEMON_MD = `---
version: alpha
name: Lululemon UK Design Spec
description: An accurate design specification of Lululemon UK — an energetic, premium athletic performance system built on crisp white canvas, deep obsidian type, vibrant Lululemon Red accents (#D31334), square 0px radii, and bold uppercase athletic typography.

colors:
  primary: "#D31334"
  primary-active: "#B00E29"
  secondary: "#111111"
  on-primary: "#ffffff"
  canvas: "#ffffff"
  canvas-soft: "#f7f7f7"
  surface: "#ffffff"
  ink: "#000000"
  ink-secondary: "#333333"
  ink-muted: "#666666"
  hairline: "#e5e5e5"

typography:
  display-1:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -1.5px
  heading-1:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.75px
  heading-2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    letterSpacing: 0.5px
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 700
    letterSpacing: 1px

rounded:
  xs: 0px
  sm: 0px
  md: 0px
  lg: 0px
  full: 9999px

spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

components:
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    logoColor: "{colors.primary}"
    borderBottom: "1px solid {colors.hairline}"
    padding: "12px 32px"
    position: "sticky"
    top: "0"
    zIndex: "1000"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xs}"
    padding: "14px 28px"
    fontSize: "14px"
    fontWeight: "700"
    letterSpacing: "1px"
    textTransform: "uppercase"
  button-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "14px 28px"
    fontSize: "14px"
    fontWeight: "700"
  product-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xs}"
    padding: "0"
    gap: "12px"
---

## Universal Section Specs

---

### section_00_announcement_bar
**Purpose**: Thin promotional strip at the very top of the page. Rotating messages with left/right arrow controls.
- **HTML Contract**:
  \`\`\`html
  <div class="lulu-announcement-bar">
    <button class="lulu-ann-arrow" aria-label="Previous">&#10094;</button>
    <p class="lulu-ann-text">
      Made to feel good on the move—explore the <a href="#women">women's</a> and <a href="#men">men's</a> travel shop.
    </p>
    <button class="lulu-ann-arrow" aria-label="Next">&#10095;</button>
  </div>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-announcement-bar {
    background: #f7f7f7;
    border-bottom: 1px solid #e5e5e5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 9px 16px;
    font-size: 12px;
    font-weight: 500;
    color: #111111;
    text-align: center;
  }
  .lulu-ann-arrow {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: #666666;
    padding: 0 4px;
  }
  .lulu-ann-text { flex: 1; text-align: center; }
  .lulu-ann-text a { color: #111111; text-decoration: underline; font-weight: 600; }
  \`\`\`

---

### section_01_header_nav
**Purpose**: Sticky global navigation bar. Contains logo, primary category links, search pill, region selector, account and bag icons.
- **HTML Contract**:
  \`\`\`html
  <header class="lulu-header">
    <div class="lulu-header-inner">
      <!-- Logo -->
      <a href="/" class="lulu-brand">
        <svg class="lulu-omega-icon" viewBox="0 0 40 40" width="32" height="32" fill="#D31334">
          <path d="M20 2C10.06 2 2 10.06 2 20C2 29.94 10.06 38 20 38C29.94 38 38 29.94 38 20C38 10.06 29.94 2 20 2ZM20 34C12.27 34 6 27.73 6 20C6 12.27 12.27 6 20 6C27.73 6 34 12.27 34 20C34 24.2 32.1 27.97 29.1 30.5C27.64 28.1 25.0 26.5 22 26.5C21.0 26.5 20.05 26.7 19.2 27.0C18.35 26.7 17.4 26.5 16.4 26.5C13.4 26.5 10.76 28.1 9.3 30.5C6.3 27.97 4.4 24.2 4.4 20H6C6 27.73 12.27 34 20 34Z"/>
        </svg>
        <span class="lulu-wordmark">lululemon</span>
      </a>
      <!-- Primary Navigation -->
      <nav class="lulu-nav-links" aria-label="Main navigation">
        <a href="/en-gb/c/womens" class="lulu-nav-link">Women</a>
        <a href="/en-gb/c/mens" class="lulu-nav-link">Men</a>
        <a href="/en-gb/c/accessories" class="lulu-nav-link">Accessories</a>
        <a href="/en-gb/c/bags" class="lulu-nav-link">Bags</a>
        <a href="/en-gb/c/whats-new" class="lulu-nav-link">What's New</a>
        <a href="/en-gb/community" class="lulu-nav-link">The Community</a>
      </nav>
      <!-- Right Actions -->
      <div class="lulu-nav-actions">
        <div class="lulu-search-pill">
          <svg width="16" height="16" fill="none" stroke="#111" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span class="lulu-search-label">Search</span>
        </div>
        <button class="lulu-region-btn">
          <svg width="16" height="16" fill="none" stroke="#111" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span>United Kingdom (GBP)</span>
        </button>
        <a href="/en-gb/account" class="lulu-icon-btn" aria-label="Account">
          <svg width="20" height="20" fill="none" stroke="#111" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </a>
        <a href="/en-gb/bag" class="lulu-icon-btn" aria-label="Bag">
          <svg width="20" height="20" fill="none" stroke="#111" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </a>
      </div>
    </div>
  </header>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-header {
    background: #ffffff;
    border-bottom: 1px solid #e5e5e5;
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  .lulu-header-inner {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 32px;
  }
  .lulu-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    flex-shrink: 0;
  }
  .lulu-wordmark {
    font-size: 20px;
    font-weight: 800;
    color: #111111;
    letter-spacing: -0.5px;
  }
  .lulu-nav-links {
    display: flex;
    align-items: center;
    gap: 28px;
    flex: 1;
  }
  .lulu-nav-link {
    font-size: 14px;
    font-weight: 700;
    color: #111111;
    text-decoration: none;
    white-space: nowrap;
    position: relative;
    padding-bottom: 2px;
  }
  .lulu-nav-link:hover::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    right: 0;
    height: 2px;
    background: #D31334;
  }
  .lulu-nav-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .lulu-search-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1.5px solid #111111;
    border-radius: 9999px;
    padding: 7px 16px;
    cursor: pointer;
    min-width: 180px;
  }
  .lulu-search-label { font-size: 13px; color: #666666; }
  .lulu-region-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: #111111;
    white-space: nowrap;
  }
  .lulu-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #111111;
    text-decoration: none;
    padding: 4px;
  }
  \`\`\`

---

### section_02_hero_banner
**Purpose**: Full-bleed hero with athletic action image/video, gradient overlay, bold title, subtitle, dual white pill CTAs, and bottom-right video playback controls.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-hero" id="hero">
    <div class="lulu-hero-media">
      <img src="{{image}}" alt="{{title}}" class="lulu-hero-img" />
    </div>
    <div class="lulu-hero-overlay"></div>
    <div class="lulu-hero-content">
      <div class="lulu-hero-text">
        <h1 class="lulu-hero-title">{{title}}</h1>
        <p class="lulu-hero-subtitle">{{subtitle}}</p>
        <div class="lulu-hero-ctas">
          <a href="{{ctaUrl}}" class="lulu-pill-btn">{{ctaText}}</a>
          <a href="{{cta2Url}}" class="lulu-pill-btn">{{cta2Text}}</a>
        </div>
      </div>
      <div class="lulu-hero-controls">
        <button class="lulu-ctrl-btn" aria-label="Play/Pause">&#9654;</button>
        <button class="lulu-ctrl-btn" aria-label="Previous">&#8592;</button>
        <button class="lulu-ctrl-btn" aria-label="Next">&#8594;</button>
      </div>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-hero {
    position: relative;
    width: 100%;
    min-height: 88vh;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .lulu-hero-media {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .lulu-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
  }
  .lulu-hero-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 60%);
  }
  .lulu-hero-content {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 48px 48px 56px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    text-align: left;
  }
  .lulu-hero-text {
    max-width: 720px;
  }
  .lulu-hero-title {
    font-size: clamp(2.6rem, 5.5vw, 4.2rem);
    font-weight: 700;
    color: #ffffff;
    line-height: 1.08;
    letter-spacing: -1px;
    margin-bottom: 16px;
  }
  .lulu-hero-subtitle {
    font-size: clamp(1.1rem, 1.8vw, 1.35rem);
    font-weight: 400;
    color: #ffffff;
    margin-bottom: 32px;
    line-height: 1.4;
  }
  .lulu-hero-ctas {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }
  .lulu-pill-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    color: #111111;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2px;
    padding: 14px 28px;
    border-radius: 9999px;
    text-decoration: none;
    transition: background 0.2s, transform 0.15s;
    white-space: nowrap;
  }
  .lulu-pill-btn:hover { background: #f4f4f4; }
  .lulu-hero-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    align-self: flex-end;
    padding-bottom: 4px;
    flex-shrink: 0;
  }
  .lulu-ctrl-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    border: 1.5px solid rgba(255,255,255,0.4);
    color: #ffffff;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 0.2s, border-color 0.2s;
  }
  .lulu-ctrl-btn:hover { background: rgba(0,0,0,0.8); border-color: #ffffff; }
    transition: background 0.2s;
  }
  .lulu-ctrl-btn:hover { background: rgba(0,0,0,0.7); }
  \`\`\`

---

### section_03_category_tiles
**Purpose**: 2–3 column editorial image tiles linking to Women, Men, and Accessories categories. Each tile has a full-bleed image with a title and CTA at the bottom-left.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-categories" id="categories">
    <div class="lulu-categories-grid">
      <a href="/en-gb/c/womens" class="lulu-cat-tile">
        <img src="{{women_image}}" alt="Women's" class="lulu-cat-img" />
        <div class="lulu-cat-content">
          <h2 class="lulu-cat-title">Women</h2>
          <span class="lulu-cat-link">Shop Women &#8594;</span>
        </div>
      </a>
      <a href="/en-gb/c/mens" class="lulu-cat-tile">
        <img src="{{men_image}}" alt="Men's" class="lulu-cat-img" />
        <div class="lulu-cat-content">
          <h2 class="lulu-cat-title">Men</h2>
          <span class="lulu-cat-link">Shop Men &#8594;</span>
        </div>
      </a>
      <a href="/en-gb/c/whats-new" class="lulu-cat-tile">
        <img src="{{new_image}}" alt="What's New" class="lulu-cat-img" />
        <div class="lulu-cat-content">
          <h2 class="lulu-cat-title">What's New</h2>
          <span class="lulu-cat-link">Shop New &#8594;</span>
        </div>
      </a>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-categories { padding: 0; background: #ffffff; }
  .lulu-categories-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .lulu-cat-tile {
    position: relative;
    display: block;
    overflow: hidden;
    aspect-ratio: 3/4;
    text-decoration: none;
  }
  .lulu-cat-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }
  .lulu-cat-tile:hover .lulu-cat-img { transform: scale(1.03); }
  .lulu-cat-content {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 24px;
    background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%);
  }
  .lulu-cat-title {
    font-size: 28px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
  }
  .lulu-cat-link {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.5px;
  }
  \`\`\`

---

### section_04_product_grid
**Purpose**: Multi-column showcase product grid. Top header features large campaign title, subtitle, and dual action pill buttons on the right. Bottom grid presents clean 4-5 column product cards with title, price, and color swatches.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-products" id="products">
    <div class="lulu-products-header">
      <div class="lulu-products-heading-group">
        <h2 class="lulu-products-title">{{title}}</h2>
        <p class="lulu-products-subtitle">{{subtitle}}</p>
      </div>
      <div class="lulu-products-actions">
        <a href="{{ctaUrl}}" class="lulu-pill-btn-dark">{{ctaText}}</a>
        <a href="{{cta2Url}}" class="lulu-pill-btn-outline">{{cta2Text}}</a>
      </div>
    </div>
    <div class="lulu-product-grid">
      {{#each items}}
      <article class="lulu-product-card">
        <div class="lulu-product-img-wrap">
          <img src="{{image}}" alt="{{name}}" class="lulu-product-img lulu-product-img-primary" loading="lazy" />
          <img src="{{hoverImage}}" alt="{{name}}" class="lulu-product-img lulu-product-img-hover" loading="lazy" />
          {{#if badge}}<span class="lulu-product-badge">{{badge}}</span>{{/if}}
          <button class="lulu-quick-add">Quick Add</button>
        </div>
        <div class="lulu-product-info">
          <div class="lulu-product-row">
            <h3 class="lulu-product-name">{{name}}</h3>
            <span class="lulu-price">&pound;{{price}}</span>
          </div>
          {{#if colors}}
          <div class="lulu-color-swatches">
            {{#each colors}}<span class="lulu-swatch" style="background:{{hex}}"></span>{{/each}}
            {{#if moreColors}}<span class="lulu-swatch-more">+{{moreColors}}</span>{{/if}}
          </div>
          {{/if}}
        </div>
      </article>
      {{/each}}
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-products {
    padding: 64px 48px;
    max-width: 1440px;
    margin: 0 auto;
    background: #ffffff;
  }
  .lulu-products-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 40px;
    gap: 32px;
    flex-wrap: wrap;
  }
  .lulu-products-heading-group {
    max-width: 720px;
  }
  .lulu-products-title {
    font-size: clamp(2.4rem, 4.5vw, 3.8rem);
    font-weight: 700;
    color: #111111;
    line-height: 1.08;
    letter-spacing: -1px;
    margin-bottom: 12px;
  }
  .lulu-products-subtitle {
    font-size: 16px;
    color: #333333;
    line-height: 1.4;
  }
  .lulu-products-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-shrink: 0;
  }
  .lulu-pill-btn-dark {
    background: #111111;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    padding: 12px 24px;
    border-radius: 9999px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .lulu-pill-btn-dark:hover { background: #D31334; }
  .lulu-pill-btn-outline {
    background: transparent;
    color: #111111;
    border: 1.5px solid #111111;
    font-size: 13px;
    font-weight: 700;
    padding: 12px 24px;
    border-radius: 9999px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .lulu-pill-btn-outline:hover { background: #111111; color: #ffffff; }
  .lulu-product-grid {
    display: grid !important;
    grid-template-columns: repeat(5, 1fr) !important;
    gap: 20px !important;
    width: 100% !important;
  }
  .lulu-product-card { position: relative; display: flex; flex-direction: column; width: 100%; }
  .lulu-product-img-wrap {
    position: relative;
    overflow: hidden;
    aspect-ratio: 3/4;
    background: #f4f4f4;
    margin-bottom: 12px;
  }
  .lulu-product-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    inset: 0;
    transition: opacity 0.35s ease;
  }
  .lulu-product-img-hover { opacity: 0; }
  .lulu-product-img-wrap:hover .lulu-product-img-primary { opacity: 0; }
  .lulu-product-img-wrap:hover .lulu-product-img-hover { opacity: 1; }
  .lulu-product-badge {
    position: absolute;
    top: 12px; left: 12px;
    background: #D31334;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 4px 8px;
    text-transform: uppercase;
  }
  .lulu-quick-add {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: #111111;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 12px;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.25s;
    text-transform: uppercase;
  }
  .lulu-product-img-wrap:hover .lulu-quick-add { opacity: 1; }
  .lulu-product-info { display: flex; flex-direction: column; gap: 6px; }
  .lulu-product-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .lulu-product-name { font-size: 14px; font-weight: 700; color: #111111; line-height: 1.3; }
  .lulu-price { font-size: 14px; font-weight: 600; color: #111111; flex-shrink: 0; }
  .lulu-color-swatches { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
  .lulu-swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #e5e5e5; }
  .lulu-swatch-more { font-size: 11px; color: #666666; }
  \`\`\`

---

### section_05_perks_bar
**Purpose**: Full-bleed dark atmospheric shipping banner with centered white headline and delivery terms text.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-shipping-banner" id="shipping">
    <div class="lulu-shipping-bg">
      <img src="https://images.lululemon.com/is/image/lululemon/7924_July_WK2_Homepage_Alpine_05_ShippingBanner_D?wid=1440&op_usm=0.5,2,10,0&fmt=webp&qlt=80,1&fit=constrain,0&op_sharpen=0&resMode=sharp2&iccEmbed=0&printRes=72" alt="Free delivery and returns" class="lulu-shipping-img" />
    </div>
    <div class="lulu-shipping-overlay"></div>
    <div class="lulu-shipping-content">
      <h2 class="lulu-shipping-title">Free delivery and returns.</h2>
      <p class="lulu-shipping-desc">Enjoy free standard delivery on orders over &pound;50, otherwise &pound;4.</p>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-shipping-banner {
    position: relative;
    width: 100%;
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #111111;
  }
  .lulu-shipping-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .lulu-shipping-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lulu-shipping-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%);
  }
  .lulu-shipping-content {
    position: relative;
    z-index: 2;
    text-align: center;
    color: #ffffff;
    padding: 48px 24px;
    max-width: 900px;
  }
  .lulu-shipping-title {
    font-size: clamp(2.2rem, 5vw, 3.8rem);
    font-weight: 700;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -0.5px;
    margin-bottom: 12px;
  }
  .lulu-shipping-desc {
    font-size: clamp(1rem, 1.8vw, 1.25rem);
    font-weight: 400;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.4;
  }
  \`\`\`

---

### section_06_editorial_split
**Purpose**: Full-width atmospheric background feature banner with left-aligned card box containing headline, subtext, and pill CTA button.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-editorial" id="story">
    <div class="lulu-editorial-bg">
      <img src="{{image}}" alt="{{title}}" class="lulu-editorial-img" />
    </div>
    <div class="lulu-editorial-inner">
      <div class="lulu-editorial-card">
        <span class="lulu-editorial-eyebrow">{{eyebrow}}</span>
        <h2 class="lulu-editorial-title">{{title}}</h2>
        <p class="lulu-editorial-body">{{body}}</p>
        <a href="{{ctaUrl}}" class="lulu-pill-btn">{{ctaText}}</a>
      </div>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-editorial {
    position: relative;
    width: 100%;
    min-height: 560px;
    display: flex;
    align-items: center;
    overflow: hidden;
    background: #111111;
  }
  .lulu-editorial-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .lulu-editorial-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lulu-editorial-inner {
    position: relative;
    z-index: 1;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
    padding: 48px;
  }
  .lulu-editorial-card {
    background: #ffffff;
    padding: 48px 40px;
    max-width: 460px;
    border-radius: 4px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
  }
  .lulu-editorial-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #D31334;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: block;
  }
  .lulu-editorial-title {
    font-size: 32px;
    font-weight: 800;
    color: #111111;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin-bottom: 16px;
  }
  .lulu-editorial-body {
    font-size: 15px;
    color: #444444;
    line-height: 1.5;
    margin-bottom: 28px;
  }
  \`\`\`

---

### section_07_activity_discovery
**Purpose**: Horizontal row of activity category chips with rounded images: Yoga, Running, Training, Cycling, Hiking, Golf.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-activity" id="activities">
    <div class="lulu-activity-inner">
      <h2 class="lulu-activity-title">Shop by Activity</h2>
      <div class="lulu-activity-scroll">
        <a href="/en-gb/c/yoga" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{yoga_image}}" alt="Yoga" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Yoga</span>
        </a>
        <a href="/en-gb/c/running" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{run_image}}" alt="Running" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Running</span>
        </a>
        <a href="/en-gb/c/training" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{train_image}}" alt="Training" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Training</span>
        </a>
        <a href="/en-gb/c/cycling" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{cycle_image}}" alt="Cycling" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Cycling</span>
        </a>
        <a href="/en-gb/c/hiking" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{hike_image}}" alt="Hiking" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Hiking</span>
        </a>
        <a href="/en-gb/c/golf" class="lulu-activity-chip">
          <div class="lulu-activity-img-wrap"><img src="{{golf_image}}" alt="Golf" class="lulu-activity-img" /></div>
          <span class="lulu-activity-label">Golf</span>
        </a>
      </div>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-activity {
    padding: 64px 48px;
    background: #ffffff;
    border-top: 1px solid #e5e5e5;
  }
  .lulu-activity-inner {
    max-width: 1440px;
    margin: 0 auto;
  }
  .lulu-activity-title {
    font-size: clamp(2rem, 3.8vw, 3.2rem);
    font-weight: 700;
    color: #111111;
    margin-bottom: 36px;
    letter-spacing: -0.75px;
  }
  .lulu-activity-scroll {
    display: flex !important;
    flex-direction: row !important;
    gap: 20px !important;
    overflow-x: auto !important;
    padding-bottom: 16px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    width: 100% !important;
  }
  .lulu-activity-scroll::-webkit-scrollbar { display: none; }
  .lulu-activity-chip {
    flex: 1 0 170px;
    max-width: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-decoration: none;
  }
  .lulu-activity-img-wrap {
    width: 100%;
    aspect-ratio: 4/5;
    overflow: hidden;
    background: #f4f4f4;
  }
  .lulu-activity-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
  }
  .lulu-activity-chip:hover .lulu-activity-img {
    transform: scale(1.04);
  }
  .lulu-activity-label {
    font-size: 14px;
    font-weight: 700;
    color: #111111;
    letter-spacing: -0.2px;
  }
  \`\`\`

---

### section_08_community_banner
**Purpose**: Light newsletter subscription section. Left: large heading & subtext. Right: Email input, Women/Men checkboxes, Sign Up button, and privacy disclaimer.
- **HTML Contract**:
  \`\`\`html
  <section class="lulu-newsletter" id="newsletter">
    <div class="lulu-newsletter-inner">
      <div class="lulu-newsletter-left">
        <h2 class="lulu-newsletter-title">Our freshest gear. Straight to your inbox.</h2>
        <p class="lulu-newsletter-sub">Be first to know about our newest products, limited-time offers, community events, and more.</p>
      </div>
      <div class="lulu-newsletter-right">
        <form class="lulu-newsletter-form" onsubmit="event.preventDefault()">
          <label class="lulu-input-label" for="lulu-email-input">Email Address</label>
          <input type="email" id="lulu-email-input" class="lulu-email-box" required />
          <div class="lulu-preference-row">
            <span class="lulu-pref-label">I like to shop for</span>
            <label class="lulu-checkbox-wrap">
              <input type="checkbox" checked />
              <span class="lulu-custom-check"></span>
              <span>Women</span>
            </label>
            <label class="lulu-checkbox-wrap">
              <input type="checkbox" checked />
              <span class="lulu-custom-check"></span>
              <span>Men</span>
            </label>
          </div>
          <button type="submit" class="lulu-signup-btn">Sign Up</button>
          <p class="lulu-disclaimer-text">
            lululemon will use information you provide to deliver you relevant information about our products and services, including offerings based on your preferences and purchase history. To learn more, see our <a href="#">privacy policy</a>.
          </p>
        </form>
      </div>
    </div>
  </section>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-newsletter {
    background: #ffffff;
    padding: 80px 48px;
    border-top: 1px solid #e5e5e5;
  }
  .lulu-newsletter-inner {
    max-width: 1440px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 80px;
    align-items: flex-start;
  }
  .lulu-newsletter-title {
    font-size: clamp(2.5rem, 4.5vw, 4.2rem);
    font-weight: 700;
    color: #111111;
    line-height: 1.05;
    letter-spacing: -1.5px;
    margin-bottom: 24px;
    max-width: 600px;
  }
  .lulu-newsletter-sub {
    font-size: 18px;
    color: #333333;
    line-height: 1.5;
    max-width: 540px;
  }
  .lulu-newsletter-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 480px;
  }
  .lulu-input-label {
    font-size: 13px;
    font-weight: 700;
    color: #111111;
  }
  .lulu-email-box {
    width: 100%;
    height: 48px;
    border: 1.5px solid #111111;
    border-radius: 4px;
    padding: 0 16px;
    font-size: 15px;
    outline: none;
  }
  .lulu-preference-row {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 14px;
    font-weight: 600;
    color: #111111;
    margin-top: 4px;
  }
  .lulu-pref-label { margin-right: 4px; }
  .lulu-checkbox-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }
  .lulu-signup-btn {
    width: fit-content;
    background: #111111;
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 32px;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    margin-top: 8px;
    transition: background 0.2s;
  }
  .lulu-signup-btn:hover { background: #D31334; }
  .lulu-disclaimer-text {
    font-size: 11px;
    color: #666666;
    line-height: 1.5;
    margin-top: 8px;
  }
  .lulu-disclaimer-text a { color: #666666; text-decoration: underline; }
  \`\`\`

---

### section_09_footer
**Purpose**: Official dark footer with 4 distinct columns: Contact Us, Help, Legal, and About Us (with social icon bar).
- **HTML Contract**:
  \`\`\`html
  <footer class="lulu-footer" id="footer">
    <div class="lulu-footer-inner">
      <div class="lulu-footer-col">
        <h4 class="lulu-footer-heading">Contact Us</h4>
        <ul class="lulu-footer-links">
          <li><a href="#">Email</a></li>
          <li><a href="#">Live Chat</a></li>
          <li><a href="#">Store Locations</a></li>
        </ul>
      </div>
      <div class="lulu-footer-col">
        <h4 class="lulu-footer-heading">Help</h4>
        <ul class="lulu-footer-links">
          <li><a href="#">Klarna</a></li>
          <li><a href="#">Returns</a></li>
          <li><a href="#">Track Order &amp; Return</a></li>
          <li><a href="#">Ordering &amp; Payment</a></li>
          <li><a href="#">Delivery</a></li>
          <li><a href="#">Size Guide</a></li>
          <li><a href="#">Take our Leggings Quiz</a></li>
          <li><a href="#">Gift Cards</a></li>
          <li><a href="#">Student Discount</a></li>
        </ul>
      </div>
      <div class="lulu-footer-col">
        <h4 class="lulu-footer-heading">Legal</h4>
        <ul class="lulu-footer-links">
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Cookie Preferences</a></li>
          <li><a href="#">UK Modern Slavery Act</a></li>
          <li><a href="#">Terms of Use</a></li>
          <li><a href="#">Terms of Sale</a></li>
        </ul>
      </div>
      <div class="lulu-footer-col">
        <h4 class="lulu-footer-heading">About Us</h4>
        <ul class="lulu-footer-links">
          <li><a href="#">Inclusion, Diversity &amp; Equity</a></li>
          <li><a href="#">Our Careers</a></li>
          <li><a href="#">Our Fabric and Technology</a></li>
          <li><a href="#">Investors</a></li>
          <li><a href="#">Sweat Collective</a></li>
          <li><a href="#">Strategic Sales</a></li>
        </ul>
        <div class="lulu-footer-social">
          <a href="#" aria-label="X"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href="#" aria-label="Pinterest"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0a12 12 0 0 0-4.37 23.17c-.07-.63-.13-1.6.03-2.3.14-.6 1.05-4.48 1.05-4.48s-.27-.54-.27-1.34c0-1.25.72-2.19 1.63-2.19.77 0 1.14.58 1.14 1.27 0 .77-.49 1.93-.75 3-.21.9.45 1.63 1.34 1.63 1.6 0 2.84-1.7 2.84-4.14 0-2.17-1.56-3.68-3.79-3.68-2.58 0-4.1 1.94-4.1 3.94 0 .78.3 1.62.67 2.07.07.09.08.17.06.26l-.25 1.03c-.04.17-.14.21-.33.13-1.24-.58-2.02-2.4-2.02-3.86 0-3.14 2.29-6.03 6.59-6.03 3.46 0 6.15 2.47 6.15 5.76 0 3.44-2.17 6.2-5.18 6.2-1.01 0-1.96-.53-2.29-1.15l-.62 2.37c-.23.87-.84 1.96-1.25 2.62A11.97 11.97 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg></a>
          <a href="#" aria-label="YouTube"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
          <a href="#" aria-label="Facebook"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
          <a href="#" aria-label="Instagram"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
        </div>
      </div>
    </div>
  </footer>
  \`\`\`
- **CSS Rules**:
  \`\`\`css
  .lulu-footer {
    background: #111111;
    color: #ffffff;
    padding: 64px 48px;
  }
  .lulu-footer-inner {
    max-width: 1440px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 48px;
  }
  .lulu-footer-heading {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 20px;
  }
  .lulu-footer-links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lulu-footer-links a {
    font-size: 14px;
    color: #ffffff;
    text-decoration: none;
    line-height: 1.4;
    transition: opacity 0.2s;
  }
  .lulu-footer-links a:hover { opacity: 0.75; }
  .lulu-footer-social {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 36px;
    color: #ffffff;
  }
  .lulu-footer-social a { color: #ffffff; text-decoration: none; transition: opacity 0.2s; }
  .lulu-footer-social a:hover { opacity: 0.75; }
  \`\`\`

`;

// ─── More design specs (short frontmatter-only for token resolution) ──────────

export const NOTION_MD = `---
version: alpha
name: Notion Workspace Design Spec
colors:
  primary: "#0075de"
  secondary: "#213183"
  canvas: "#ffffff"
  canvas-soft: "#f6f5f4"
  ink: "#000000"
  hairline: "#e6e6e6"
typography:
  display-1: { fontFamily: "Inter", fontSize: "64px", fontWeight: 700 }
  heading-1: { fontFamily: "Inter", fontSize: "40px", fontWeight: 700 }
  button: { fontFamily: "Inter", fontSize: "14px", fontWeight: 600 }
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  full: "9999px"
components:
  nav-bar:
    backgroundColor: "#ffffff"
    logoColor: "#000000"
    textColor: "#31302e"
  button-primary:
    backgroundColor: "#0075de"
    textColor: "#ffffff"
    rounded: "6px"
---
`;

export const POUCH_MD = `---
version: alpha
name: Supplement Pouch Design Spec
colors:
  primary: "#000bfa"
  secondary: "#01273e"
  canvas: "#edebe4"
  canvas-soft: "#e3e0d5"
  ink: "#01273e"
  hairline: "#01273e"
typography:
  display-1: { fontFamily: "Plus Jakarta Sans", fontSize: "52px", fontWeight: 800 }
  button: { fontFamily: "monospace", fontSize: "12px", fontWeight: 700 }
rounded:
  xs: "0px"
  sm: "10px"
  full: "9999px"
components:
  nav-bar:
    backgroundColor: "rgba(237, 235, 228, 0.85)"
    logoColor: "#01273e"
    textColor: "#01273e"
  button-primary:
    backgroundColor: "#000bfa"
    textColor: "#ffffff"
    rounded: "10px"
---
`;

// ─── Registry ─────────────────────────────────────────────────────────────────

interface SpecEntry {
  tokens: DesignTokens;
  sections: Record<string, SectionSpec>;
}

const REGISTRY: Record<string, SpecEntry> = {
  lululemon: {
    tokens: parseDesignMD(LULULEMON_MD),
    sections: parseSectionSpecs(LULULEMON_MD),
  },
  notion: {
    tokens: parseDesignMD(NOTION_MD),
    sections: parseSectionSpecs(NOTION_MD),
  },
  'editorial-chalk': {
    tokens: parseDesignMD(POUCH_MD),
    sections: parseSectionSpecs(POUCH_MD),
  },
};

export function getDesignSpec(templateName: string): DesignTokens | null {
  if (!templateName) return null;
  return REGISTRY[templateName.toLowerCase()]?.tokens || null;
}

export function getDesignSections(templateName: string): Record<string, SectionSpec> {
  if (!templateName) return {};
  return REGISTRY[templateName.toLowerCase()]?.sections || {};
}
