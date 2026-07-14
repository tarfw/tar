/**
 * Section Renderer — maps SiteLayout nodes (from SECTIONS.json vocabulary) to HTML.
 *
 * Input: SiteLayout JSON with section types, layout variants, CSS overrides, responsive breakpoints
 * Output: Full HTML page with inline styles + @media queries
 *
 * Supports: hero_banner, content_grid, product_grid, service_list, text_block,
 *           testimonial, cta_button, contact_form, map_embed, faq_accordion,
 *           gallery, pricing_table, team_grid, footer
 */

import type { SiteLayout, UINode } from './types';

// ── HTML escaping ───────────────────────────────────────────────────

function esc(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── CSS object → inline style string ────────────────────────────────

function cssToInline(css: Record<string, any> | undefined): string {
  if (!css) return '';
  return Object.entries(css)
    .map(([k, v]) => {
      // camelCase → kebab-case
      const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}:${v}`;
    })
    .join(';');
}

// ── Responsive @media generation ────────────────────────────────────

function generateMediaQueries(node: UINode): string {
  const responsive = (node as any).responsive;
  if (!responsive) return '';

  const queries: string[] = [];

  if (responsive.mobile?.css) {
    const styles = cssToInline(responsive.mobile.css);
    if (styles) {
      queries.push(`@media(max-width:768px){.node-${node.id}{${styles}}}`);

      // Mobile children overrides
      if (responsive.mobile.children) {
        for (const [childId, childOverride] of Object.entries(responsive.mobile.children) as any) {
          if (childOverride.css) {
            const childStyles = cssToInline(childOverride.css);
            if (childStyles) {
              queries.push(`@media(max-width:768px){.node-${childId}{${childStyles}}}`);
            }
          }
        }
      }
    }
  }

  if (responsive.tablet?.css) {
    const styles = cssToInline(responsive.tablet.css);
    if (styles) {
      queries.push(`@media(min-width:769px) and (max-width:1024px){.node-${node.id}{${styles}}}`);
    }
  }

  return queries.join('\n');
}

// ── Section renderers ───────────────────────────────────────────────

function renderHeroBanner(node: UINode): string {
  const p = node.props;
  const css = cssToInline(node.css || {});
  const layout = node.layout || 'centered';

  let layoutStyle = '';
  if (layout === 'full-bleed') {
    layoutStyle = 'width:100vw;max-width:none;overflow:hidden;';
  } else if (layout === 'split') {
    layoutStyle = 'display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;';
  } else if (layout === 'left-aligned') {
    layoutStyle = 'text-align:left;';
  }

  const bgImage = p.image ? `background-image:url('${esc(p.image)}');background-size:cover;background-position:center;` : '';

  return `<header class="node-${node.id}" style="padding:80px 5%;position:relative;${bgImage}${layoutStyle}${css ? ';' + css : ''}">
    ${p.overlay ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:1;"></div>` : ''}
    <div style="position:relative;z-index:2;${layout === 'centered' ? 'text-align:center;max-width:800px;margin:0 auto;' : ''}">
      ${p.title ? `<h1 style="font-size:2.5rem;margin-bottom:16px;">${esc(p.title)}</h1>` : ''}
      ${p.subtitle ? `<p style="font-size:1.15rem;opacity:0.85;margin-bottom:24px;">${esc(p.subtitle)}</p>` : ''}
      ${p.cta ? `<a href="${esc(p.cta.url || '#')}" class="btn" style="display:inline-block;">${esc(p.cta.label || 'Learn More')}</a>` : ''}
    </div>
  </header>`;
}

function renderContentGrid(node: UINode): string {
  const p = node.props;
  const layout = node.layout || '2-col';
  const css = cssToInline(node.css || {});

  const colMap: Record<string, string> = {
    '1-col': '1fr',
    '2-col': '1fr 1fr',
    '3-col': 'repeat(3, 1fr)',
    '4-col': 'repeat(4, 1fr)',
    'sidebar-left': '300px 1fr',
    'sidebar-right': '1fr 300px',
  };
  const columns = colMap[layout] || '1fr 1fr';

  const childrenHtml = (node.children || [])
    .map(child => renderNode(child))
    .join('\n');

  return `<div class="node-${node.id}" style="display:grid;grid-template-columns:${columns};gap:32px;padding:48px 5%;${css}">
    ${childrenHtml}
  </div>`;
}

function renderProductGrid(node: UINode): string {
  const p = node.props;
  const layout = node.layout || '3-col';
  const css = cssToInline(node.css || {});

  const colMap: Record<string, string> = {
    '2-col': 'repeat(2, 1fr)',
    '3-col': 'repeat(3, 1fr)',
    '4-col': 'repeat(4, 1fr)',
  };
  const columns = colMap[layout] || 'repeat(3, 1fr)';

  const items = p.items || [];
  const cards = items.map((item: any) => {
    const name = typeof item === 'string' ? item : item.name || item.title || 'Product';
    const price = typeof item === 'string' ? '' : item.price ? `${item.price}` : '';
    const desc = typeof item === 'string' ? '' : item.description || '';
    return `<article style="background:white;border:1px solid rgba(0,0,0,0.06);overflow:hidden;">
      <div style="padding:24px;">
        <h3 style="font-size:1.1rem;margin-bottom:8px;">${esc(name)}</h3>
        ${desc ? `<p style="color:rgba(0,0,0,0.6);font-size:0.9rem;margin-bottom:12px;">${esc(desc)}</p>` : ''}
        ${price ? `<div style="font-weight:700;color:var(--tertiary, #D4A373);">${esc(price)}</div>` : ''}
      </div>
    </article>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="display:grid;grid-template-columns:${columns};gap:24px;padding:48px 5%;${css}">
    ${cards}
  </div>`;
}

function renderServiceList(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'cards';
  const css = cssToInline(node.css || {});

  const items = p.items || [];
  const cards = items.map((item: any) => {
    const name = typeof item === 'string' ? item : item.name || item.title || 'Service';
    const price = typeof item === 'string' ? '' : item.price ? `${item.price}` : '';
    const desc = typeof item === 'string' ? '' : item.description || '';
    return `<div style="padding:24px;border:1px solid rgba(0,0,0,0.06);background:white;">
      <h3 style="font-size:1.1rem;margin-bottom:8px;">${esc(name)}</h3>
      ${desc ? `<p style="color:rgba(0,0,0,0.6);font-size:0.9rem;margin-bottom:8px;">${esc(desc)}</p>` : ''}
      ${price ? `<div style="font-weight:700;color:var(--tertiary, #D4A373);">${esc(price)}</div>` : ''}
    </div>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:24px;padding:48px 5%;${css}">
    ${cards}
  </div>`;
}

function renderTextBlock(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'text-only';
  const css = cssToInline(node.css || {});

  if (layout === 'text-only') {
    return `<section class="node-${node.id}" style="padding:48px 5%;max-width:800px;${css}">
      ${p.heading ? `<h2 style="font-size:1.75rem;margin-bottom:16px;">${esc(p.heading)}</h2>` : ''}
      ${p.body ? `<p style="line-height:1.6;color:rgba(0,0,0,0.7);">${esc(p.body)}</p>` : ''}
    </section>`;
  }

  // Image layouts
  const isLeft = layout === 'text-left-image-right';
  const imgHtml = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.heading || '')}" style="width:100%;height:auto;" loading="lazy"/>` : '';

  return `<section class="node-${node.id}" style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;padding:48px 5%;${css}">
    <div style="${isLeft ? 'order:1' : 'order:2'}">
      ${p.heading ? `<h2 style="font-size:1.75rem;margin-bottom:16px;">${esc(p.heading)}</h2>` : ''}
      ${p.body ? `<p style="line-height:1.6;color:rgba(0,0,0,0.7);">${esc(p.body)}</p>` : ''}
    </div>
    <div style="${isLeft ? 'order:2' : 'order:1'}">
      ${imgHtml}
    </div>
  </section>`;
}

function renderTestimonial(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'single';
  const css = cssToInline(node.css || {});

  const quotes = p.quotes || [];
  const items = quotes.map((q: any) => {
    const text = typeof q === 'string' ? q : q.text || q.quote || '';
    const author = typeof q === 'string' ? '' : q.author || q.name || '';
    return `<blockquote style="padding:24px;border-left:3px solid var(--primary, #1B4332);margin:0;background:white;">
      <p style="font-size:1.05rem;line-height:1.6;margin-bottom:8px;font-style:italic;">"${esc(text)}"</p>
      ${author ? `<cite style="font-style:normal;font-weight:600;color:rgba(0,0,0,0.6);">— ${esc(author)}</cite>` : ''}
    </blockquote>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="padding:48px 5%;${css}">
    ${items}
  </div>`;
}

function renderCtaButton(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'centered';
  const css = cssToInline(node.css || {});

  const alignMap: Record<string, string> = {
    'centered': 'text-align:center;',
    'left': 'text-align:left;',
    'right': 'text-align:right;',
    'full-width': '',
  };

  const widthStyle = layout === 'full-width' ? 'display:block;width:100%;text-align:center;' : '';

  return `<div class="node-${node.id}" style="padding:32px 5%;${alignMap[layout] || ''}${css}">
    <a href="${esc(p.url || '#')}" class="btn" style="${widthStyle}">${esc(p.label || 'Learn More')}</a>
  </div>`;
}

function renderContactForm(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'centered';
  const css = cssToInline(node.css || {});

  const fields = p.fields || ['name', 'email', 'message'];
  const fieldHtml = fields.map((field: string) => {
    const label = field.charAt(0).toUpperCase() + field.slice(1);
    if (field === 'message') {
      return `<div><label style="display:block;font-weight:600;margin-bottom:4px;">${esc(label)}</label><textarea name="${esc(field)}" rows="4" style="width:100%;padding:12px;border:1px solid rgba(0,0,0,0.15);border-radius:6px;font-family:inherit;box-sizing:border-box;"></textarea></div>`;
    }
    const inputType = field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text';
    return `<div><label style="display:block;font-weight:600;margin-bottom:4px;">${esc(label)}</label><input type="${inputType}" name="${esc(field)}" required style="width:100%;padding:12px;border:1px solid rgba(0,0,0,0.15);border-radius:6px;box-sizing:border-box;"/></div>`;
  }).join('\n');

  const maxWidth = layout === 'centered' ? 'max-width:600px;margin:0 auto;' : layout === 'split' ? 'max-width:50%;' : '';

  return `<form class="node-${node.id}" style="display:flex;flex-direction:column;gap:16px;padding:48px 5%;${maxWidth}${css}">
    ${fieldHtml}
    <button type="submit" class="btn" style="margin-top:8px;">${esc(p.submit_label || 'Send')}</button>
  </form>`;
}

function renderMapEmbed(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'full-width';
  const css = cssToInline(node.css || {});

  const address = encodeURIComponent(p.address || '');
  const zoom = p.zoom || 14;
  const width = layout === 'full-width' ? 'width:100%;max-width:none;' : layout === 'split' ? 'width:50%;' : '';

  return `<div class="node-${node.id}" style="padding:0;${css}">
    <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-0.1276,51.5034,-0.1176,51.5134&layer=mapnik&marker=51.5085,-0.1257" style="border:0;width:100%;height:400px;${width}" loading="lazy" allowfullscreen></iframe>
  </div>`;
}

function renderFaqAccordion(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'single-column';
  const css = cssToInline(node.css || {});

  const items = p.items || [];
  const faqHtml = items.map((item: any) => {
    const q = typeof item === 'string' ? item : item.q || item.question || '';
    const a = typeof item === 'string' ? '' : item.a || item.answer || '';
    return `<details style="border-bottom:1px solid rgba(0,0,0,0.06);padding:16px 0;">
      <summary style="cursor:pointer;font-weight:600;font-size:1.05rem;">${esc(q)}</summary>
      <p style="margin-top:12px;color:rgba(0,0,0,0.7);line-height:1.6;">${esc(a)}</p>
    </details>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="max-width:800px;margin:0 auto;padding:48px 5%;${css}">
    ${faqHtml}
  </div>`;
}

function renderGallery(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'grid';
  const css = cssToInline(node.css || {});

  const images = p.images || [];
  const figures = images.map((img: any) => {
    const src = typeof img === 'string' ? img : img.src || img.url || '';
    const alt = typeof img === 'string' ? '' : img.alt || '';
    return `<figure style="margin:0;overflow:hidden;">
      <img src="${esc(src)}" alt="${esc(alt)}" style="width:100%;height:auto;display:block;" loading="lazy"/>
    </figure>`;
  }).join('\n');

  const layoutStyle = layout === 'carousel'
    ? 'display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;'
    : layout === 'masonry'
    ? 'columns:3;column-gap:16px;'
    : layout === 'single-row'
    ? 'display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:16px;'
    : 'display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;';

  return `<div class="node-${node.id}" style="padding:48px 5%;${layoutStyle}${css}">
    ${figures}
  </div>`;
}

function renderPricingTable(node: UINode): string {
  const p = node.props;
  const layout = node.layout || '3-col';
  const css = cssToInline(node.css || {});

  const plans = p.plans || [];
  const colMap: Record<string, string> = {
    '2-col': 'repeat(2, 1fr)',
    '3-col': 'repeat(3, 1fr)',
  };
  const columns = colMap[layout] || 'repeat(3, 1fr)';

  const cards = plans.map((plan: any, i: number) => {
    const name = plan.name || plan.title || `Plan ${i + 1}`;
    const price = plan.price || '';
    const features = plan.features || [];
    const isHighlighted = p.highlight === i || plan.highlighted;
    const featureList = features.map((f: string) => `<li style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.05);">${esc(f)}</li>`).join('');

    return `<div style="background:white;border:1px solid ${isHighlighted ? 'var(--primary, #1B4332)' : 'rgba(0,0,0,0.06)'};padding:32px;text-align:center;${isHighlighted ? 'border-width:2px;' : ''}">
      <h3 style="font-size:1.25rem;margin-bottom:8px;">${esc(name)}</h3>
      <div style="font-size:2rem;font-weight:700;color:var(--tertiary, #D4A373);margin-bottom:24px;">${esc(String(price))}</div>
      <ul style="list-style:none;padding:0;text-align:left;">${featureList}</ul>
      <a href="#" class="btn" style="display:block;margin-top:24px;text-align:center;">Get Started</a>
    </div>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="display:grid;grid-template-columns:${columns};gap:24px;padding:48px 5%;${css}">
    ${cards}
  </div>`;
}

function renderTeamGrid(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'grid';
  const css = cssToInline(node.css || {});

  const members = p.members || [];
  const cards = members.map((m: any) => {
    const name = m.name || '';
    const role = m.role || '';
    const bio = m.bio || '';
    return `<div style="text-align:center;padding:24px;">
      <h3 style="font-size:1.1rem;margin-bottom:4px;">${esc(name)}</h3>
      <div style="color:var(--tertiary, #D4A373);font-weight:600;margin-bottom:8px;">${esc(role)}</div>
      ${bio ? `<p style="color:rgba(0,0,0,0.6);font-size:0.9rem;">${esc(bio)}</p>` : ''}
    </div>`;
  }).join('\n');

  return `<div class="node-${node.id}" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:24px;padding:48px 5%;${css}">
    ${cards}
  </div>`;
}

function renderFooter(node: UINode): string {
  const p = node.props;
  const layout = node.layout || 'multi-column';
  const css = cssToInline(node.css || {});

  const links = p.links || [];
  const social = p.social || [];

  const linkHtml = links.map((link: any) => {
    const href = typeof link === 'string' ? link : link.url || '#';
    const label = typeof link === 'string' ? link.replace(/^\//, '').toUpperCase() || 'HOME' : link.label || '';
    return `<a href="${esc(href)}" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:0.9rem;">${esc(label)}</a>`;
  }).join('\n');

  const socialHtml = social.map((s: string) => `<span style="color:rgba(255,255,255,0.6);font-size:0.85rem;">${esc(s)}</span>`).join(' &middot; ');

  return `<footer class="node-${node.id}" style="background:var(--secondary, #2D6A4F);color:white;padding:48px 5%;text-align:center;${css}">
    <div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px;">${linkHtml}</div>
    ${socialHtml ? `<div style="margin-bottom:16px;">${socialHtml}</div>` : ''}
    <div style="font-size:0.85rem;color:rgba(255,255,255,0.5);">&copy; ${new Date().getFullYear()} ${esc(p.workspaceName || '')}</div>
  </footer>`;
}

// ── Node router ─────────────────────────────────────────────────────

const RENDERERS: Record<string, (node: UINode) => string> = {
  hero_banner: renderHeroBanner,
  content_grid: renderContentGrid,
  product_grid: renderProductGrid,
  service_list: renderServiceList,
  text_block: renderTextBlock,
  testimonial: renderTestimonial,
  cta_button: renderCtaButton,
  contact_form: renderContactForm,
  map_embed: renderMapEmbed,
  faq_accordion: renderFaqAccordion,
  gallery: renderGallery,
  pricing_table: renderPricingTable,
  team_grid: renderTeamGrid,
  footer: renderFooter,
};

function renderNode(node: UINode): string {
  const renderer = RENDERERS[node.type];
  if (!renderer) return '';
  return renderer(node);
}

// ── Full page render ────────────────────────────────────────────────

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
  const { colors, typography, rounded, spacing } = tokens;

  const route = plan.routes[0];
  if (!route) {
    return `<!DOCTYPE html><html><body><p>No layout available</p></body></html>`;
  }

  // Render all nodes
  const contentHtml = route.nodes
    .map(node => renderNode(node))
    .filter(html => html.length > 0)
    .join('\n');

  // Collect responsive media queries
  const mediaQueries: string[] = [];
  for (const node of route.nodes) {
    const mq = generateMediaQueries(node);
    if (mq) mediaQueries.push(mq);
  }

  // CSS from design tokens
  const styles = `
    :root {
      --primary: ${colors.primary || '#1B4332'};
      --secondary: ${colors.secondary || '#2D6A4F'};
      --tertiary: ${colors.tertiary || '#D4A373'};
      --neutral: ${colors.neutral || '#FEFAE0'};
      --on-primary: ${colors['on-primary'] || '#FFFFFF'};
      --rounded-sm: ${rounded.sm || '6px'};
      --rounded-md: ${rounded.md || '12px'};
      --rounded-lg: ${rounded.lg || '16px'};
      --spacing-xs: ${spacing.xs || '4px'};
      --spacing-sm: ${spacing.sm || '8px'};
      --spacing-md: ${spacing.md || '16px'};
      --spacing-lg: ${spacing.lg || '24px'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--neutral);
      color: var(--primary);
      font-family: "${typography['body-md']?.fontFamily || typography.body?.fontFamily || 'Inter'}", sans-serif;
      line-height: 1.5;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "${typography.h1?.fontFamily || 'Inter'}", sans-serif;
      font-weight: 700;
    }
    .btn {
      background: var(--tertiary);
      color: var(--on-primary);
      border: none;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--rounded-sm);
      cursor: pointer;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
    }
    .btn:hover { opacity: 0.9; }
    img { max-width: 100%; height: auto; }
    ${mediaQueries.join('\n')}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(workspaceName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
}
