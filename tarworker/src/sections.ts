/**
 * Section renderers for the Worker.
 * Same as phone app but runs in CF Worker (no React Native).
 */

import type { StorefrontProduct } from './schema';

export type SectionRenderer = (config: Record<string, any>, products?: StorefrontProduct[]) => string;

export const SECTION_RENDERERS: Record<string, SectionRenderer> = {
  hero,
  hero_carousel,
  product_grid,
  product_carousel,
  lookbook_grid,
  testimonials,
  newsletter,
  promo_tiles,
  category_row,
  rich_text,
  brand_story,
  social_proof,
  countdown,
  section_header,
  announcement_bar,
  footer,
};

function hero(c: Record<string, any>): string {
  return `
<section class="relative min-h-[70vh] flex items-center justify-center text-center px-6 py-20">
  <div>
    <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-4">${c.headline || 'Welcome'}</h1>
    ${c.subtext ? `<p class="text-lg opacity-70 mb-8 max-w-md mx-auto">${c.subtext}</p>` : ''}
    ${c.cta ? `<a href="${c.ctaLink || '#'}" class="inline-block border-2 border-current px-8 py-3 text-sm tracking-widest uppercase hover:opacity-80 transition">${c.cta}</a>` : ''}
  </div>
</section>`;
}

function hero_carousel(c: Record<string, any>): string {
  const slides = c.slides || [{ headline: 'Welcome' }];
  return `
<section class="relative overflow-hidden">
  <div class="flex">
    ${slides.map((s: any, i: number) => `
    <div class="min-w-full min-h-[70vh] flex items-center justify-center py-20 px-6 ${i === 0 ? '' : 'hidden'}">
      <div class="text-center">
        <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-4">${s.headline || ''}</h1>
        ${s.subtext ? `<p class="text-lg opacity-70 mb-8">${s.subtext}</p>` : ''}
        ${s.cta ? `<a href="${s.ctaLink || '#'}" class="inline-block border-2 border-current px-8 py-3 text-sm tracking-widest uppercase hover:opacity-80 transition">${s.cta}</a>` : ''}
      </div>
    </div>`).join('')}
  </div>
</section>`;
}

function product_grid(c: Record<string, any>, products?: StorefrontProduct[]): string {
  const cols = c.columns || 2;
  const items = products?.length ? products : (c.products || []);
  const title = c.title || '';

  const cards = items.length
    ? items.map((p: any) => `
    <div class="group flex flex-col justify-between" data-product-id="${p.name}">
      <div>
        <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
          <img src="${p.imageUrl || `https://placehold.co/600x800/EEE/999?text=${encodeURIComponent(p.name || 'Item')}`}" alt="${p.name || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        </div>
        <p class="text-sm font-medium">${p.name || 'Item'}</p>
        ${p.price != null ? `<p class="text-sm opacity-60 mt-1">₹${p.price}</p>` : ''}
        ${p.variants && p.variants.length ? `
          <div class="mt-2 text-xs flex items-center justify-between">
            <span class="opacity-60">Size:</span>
            <select class="variant-select border border-gray-300 rounded px-1 py-0.5 bg-transparent text-xs text-inherit">
              ${p.variants.map((v: string) => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </div>` : ''}
        ${p.modifiers && p.modifiers.length ? `
          <div class="mt-1 text-xs flex items-center justify-between">
            <span class="opacity-60">Add-on:</span>
            <select class="modifier-select border border-gray-300 rounded px-1 py-0.5 bg-transparent text-xs text-inherit">
              <option value="">None</option>
              ${p.modifiers.map((m: string) => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>
      <button class="add-to-cart-btn mt-3 w-full border border-current py-2 text-xs uppercase tracking-wider hover:bg-current hover:text-white transition-colors duration-200" 
              data-name="${p.name}" data-price="${p.price ?? 0}">
        Add to Cart
      </button>
    </div>`).join('')
    : `<p class="col-span-full text-center opacity-40 text-sm">No products yet</p>`;

  return `
<section class="px-6 py-16">
  ${title ? `<h2 class="text-2xl font-bold tracking-widest uppercase text-center mb-12">${title}</h2>` : ''}
  <div class="grid grid-cols-2 md:grid-cols-${cols} gap-6 max-w-6xl mx-auto">${cards}</div>
</section>`;
}

function product_carousel(c: Record<string, any>, products?: StorefrontProduct[]): string {
  const items = products?.length ? products : (c.products || []);
  const cards = items.map((p: any) => `
  <div class="min-w-[200px] flex-shrink-0 flex flex-col justify-between" data-product-id="${p.name}">
    <div>
      <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
        <img src="${p.imageUrl || `https://placehold.co/600x800/EEE/999?text=${encodeURIComponent(p.name || 'Item')}`}" alt="${p.name || ''}" class="w-full h-full object-cover" loading="lazy" />
      </div>
      <p class="text-sm font-medium">${p.name || 'Item'}</p>
      ${p.price != null ? `<p class="text-sm opacity-60 mt-1">₹${p.price}</p>` : ''}
      ${p.variants && p.variants.length ? `
        <div class="mt-2 text-xs flex items-center justify-between">
          <span class="opacity-60">Size:</span>
          <select class="variant-select border border-gray-300 rounded px-1 py-0.5 bg-transparent text-xs text-inherit">
            ${p.variants.map((v: string) => `<option value="${v}">${v}</option>`).join('')}
          </select>
        </div>` : ''}
      ${p.modifiers && p.modifiers.length ? `
        <div class="mt-1 text-xs flex items-center justify-between">
          <span class="opacity-60">Add-on:</span>
          <select class="modifier-select border border-gray-300 rounded px-1 py-0.5 bg-transparent text-xs text-inherit">
            <option value="">None</option>
            ${p.modifiers.map((m: string) => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>` : ''}
    </div>
    <button class="add-to-cart-btn mt-3 w-full border border-current py-2 text-xs uppercase tracking-wider hover:bg-current hover:text-white transition-colors duration-200" 
            data-name="${p.name}" data-price="${p.price ?? 0}">
      Add to Cart
    </button>
  </div>`).join('');

  return `
<section class="px-6 py-16">
  <div class="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">${cards}</div>
</section>`;
}

function lookbook_grid(c: Record<string, any>): string {
  const images = c.images || [];
  const cols = c.columns || 2;

  const cells = images.map((img: any) => `
  <div class="relative aspect-[3/4] overflow-hidden">
    <img src="${img.imageUrl || 'https://placehold.co/600x800/EEE/999'}" alt="${img.caption || ''}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
    ${img.caption ? `<p class="absolute bottom-3 left-3 text-xs tracking-widest uppercase text-white drop-shadow">${img.caption}</p>` : ''}
  </div>`).join('');

  return `
<section class="px-6 py-16">
  <div class="grid grid-cols-2 md:grid-cols-${cols} gap-1 max-w-6xl mx-auto">${cells}</div>
</section>`;
}

function testimonials(c: Record<string, any>): string {
  const items = c.items || [];
  const headline = c.headline || 'What People Say';

  const cards = items.map((t: any) => `
  <div class="bg-gray-50 p-8 text-center">
    ${t.rating ? `<div class="mb-4">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>` : ''}
    <p class="text-sm italic leading-relaxed mb-6">"${t.quote || ''}"</p>
    <p class="text-xs font-semibold tracking-wide uppercase">${t.author || 'Anonymous'}</p>
    ${t.role ? `<p class="text-xs opacity-50 mt-1">${t.role}</p>` : ''}
  </div>`).join('');

  return `
<section class="px-6 py-16">
  <h2 class="text-2xl font-bold tracking-widest uppercase text-center mb-12">${headline}</h2>
  <div class="grid md:grid-cols-${Math.min(items.length, 3)} gap-6 max-w-5xl mx-auto">${cards}</div>
</section>`;
}

function newsletter(c: Record<string, any>): string {
  return `
<section class="px-6 py-20 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-4">${c.headline || 'Stay in the Loop'}</h2>
  <p class="text-sm opacity-60 mb-8 max-w-md mx-auto">${c.subtext || 'Get the latest drops and stories delivered to your inbox.'}</p>
  <form class="flex max-w-md mx-auto gap-0">
    <input type="email" placeholder="${c.placeholder || 'Enter your email'}" class="flex-1 px-4 py-3 bg-transparent border border-current text-sm outline-none" />
    <button type="submit" class="px-6 py-3 text-sm font-semibold tracking-wider uppercase hover:opacity-90 transition">${c.buttonText || 'Subscribe'}</button>
  </form>
</section>`;
}

function promo_tiles(c: Record<string, any>): string {
  const tiles = c.tiles || [];
  const cells = tiles.map((t: any) => `
  <a href="${t.href || '#'}" class="relative aspect-[4/5] overflow-hidden block">
    <img src="${t.imageUrl || 'https://placehold.co/600x750/EEE/999'}" alt="${t.title || ''}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
      <p class="text-white text-lg font-bold tracking-widest uppercase">${t.title || ''}</p>
    </div>
  </a>`).join('');

  return `
<section class="px-6 py-16">
  <div class="grid grid-cols-2 gap-1 max-w-6xl mx-auto">${cells}</div>
</section>`;
}

function category_row(c: Record<string, any>): string {
  const categories = c.categories || [];
  const items = categories.map((cat: any) => `
  <a href="${cat.href || '#'}" class="text-center flex-shrink-0 w-28">
    <div class="w-28 h-28 rounded-full overflow-hidden bg-gray-100 mb-3 mx-auto">
      ${cat.imageUrl ? `<img src="${cat.imageUrl}" alt="${cat.name || ''}" class="w-full h-full object-cover" loading="lazy" />` : ''}
    </div>
    <p class="text-xs font-medium tracking-wider uppercase">${cat.name || ''}</p>
  </a>`).join('');

  return `
<section class="px-6 py-16">
  <div class="flex gap-8 justify-center overflow-x-auto pb-4">${items}</div>
</section>`;
}

function rich_text(c: Record<string, any>): string {
  const align = c.align || 'left';
  const maxW = align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : '';
  return `
<section class="px-6 py-16">
  <div class="max-w-3xl ${maxW}">
    <p class="text-base leading-relaxed opacity-80">${c.text || ''}</p>
  </div>
</section>`;
}

function brand_story(c: Record<string, any>): string {
  const align = c.align || 'image-left';
  const imageCol = c.imageUrl
    ? `<div class="flex-1 min-h-[300px]"><img src="${c.imageUrl}" alt="${c.heading || ''}" class="w-full h-full object-cover" loading="lazy" /></div>`
    : `<div class="flex-1 min-h-[300px] bg-gray-100"></div>`;

  const textCol = `
<div class="flex-1 flex flex-col justify-center px-8 py-16">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-6">${c.heading || 'Our Story'}</h2>
  <p class="text-sm leading-relaxed opacity-70 mb-8">${c.body || ''}</p>
  ${c.cta ? `<a href="${c.ctaLink || '#'}" class="self-start border border-current px-6 py-3 text-xs tracking-widest uppercase hover:opacity-80 transition">${c.cta}</a>` : ''}
</div>`;

  return `
<section class="flex flex-wrap">
  ${align === 'image-right' ? `${textCol}${imageCol}` : `${imageCol}${textCol}`}
</section>`;
}

function social_proof(c: Record<string, any>): string {
  const stats = c.stats || [{ value: c.metric || '10,000+', label: c.label || 'Happy Customers' }];
  const items = stats.map((s: any) => `
  <div class="text-center px-8 py-4">
    <p class="text-4xl md:text-5xl font-bold">${s.value}</p>
    <p class="text-xs tracking-widest uppercase opacity-50 mt-2">${s.label}</p>
  </div>`).join('');

  return `
<section class="px-6 py-16">
  <div class="flex flex-wrap justify-center max-w-4xl mx-auto">${items}</div>
</section>`;
}

function countdown(c: Record<string, any>): string {
  const target = c.targetDate || new Date(Date.now() + 7 * 86400000).toISOString();
  return `
<section class="px-6 py-20 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-12">${c.label || 'Coming Soon'}</h2>
  <div class="flex gap-8 justify-center flex-wrap">
    <div><p class="text-5xl font-bold" id="cd-d">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Days</p></div>
    <div><p class="text-5xl font-bold" id="cd-h">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Hours</p></div>
    <div><p class="text-5xl font-bold" id="cd-m">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Min</p></div>
    <div><p class="text-5xl font-bold" id="cd-s">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Sec</p></div>
  </div>
  <script>(function(){var t=new Date('${target}').getTime();function u(){var d=Math.max(0,t-Date.now()),dd=Math.floor(d/864e5),hh=Math.floor(d%864e5/36e5),mm=Math.floor(d%36e5/6e4),ss=Math.floor(d%6e4/1e3);var D=document.getElementById('cd-d'),H=document.getElementById('cd-h'),M=document.getElementById('cd-m'),S=document.getElementById('cd-s');if(D)D.textContent=dd<10?'0'+dd:dd;if(H)H.textContent=hh<10?'0'+hh:hh;if(M)M.textContent=mm<10?'0'+mm:mm;if(S)S.textContent=ss<10?'0'+ss:ss;if(d>0)requestAnimationFrame(u)}u()})();</script>
</section>`;
}

function section_header(c: Record<string, any>): string {
  return `
<section class="px-6 py-16 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase">${c.title || 'Collection'}</h2>
  ${c.subtitle ? `<p class="text-sm opacity-50 mt-3 max-w-md mx-auto">${c.subtitle}</p>` : ''}
</section>`;
}

function announcement_bar(c: Record<string, any>): string {
  return `
<div class="text-center py-2.5 px-6 text-xs tracking-widest uppercase font-medium">
  ${c.text ? (c.link ? `<a href="${c.link}" class="no-underline">${c.text}</a>` : c.text) : 'Free shipping on orders over ₹999'}
</div>`;
}

function footer(c: Record<string, any>): string {
  const links = c.links || [];
  const linksHtml = links.map((l: any) => `<a href="${l.href || '#'}" class="text-xs opacity-60 hover:opacity-100 transition no-underline">${l.label}</a>`).join('<span class="opacity-20 mx-3">·</span>');

  return `
<footer class="text-center py-16 px-6">
  <div class="flex justify-center flex-wrap gap-0 mb-8">${linksHtml}</div>
  <p class="text-xs opacity-30">&copy; ${new Date().getFullYear()} All rights reserved</p>
</footer>`;
}
