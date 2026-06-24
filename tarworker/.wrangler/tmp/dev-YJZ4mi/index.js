var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-JaNyo6/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/sections.ts
var SECTION_RENDERERS = {
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
  footer
};
function hero(c) {
  return `
<section class="relative min-h-[70vh] flex items-center justify-center text-center px-6 py-20">
  <div>
    <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-4">${c.headline || "Welcome"}</h1>
    ${c.subtext ? `<p class="text-lg opacity-70 mb-8 max-w-md mx-auto">${c.subtext}</p>` : ""}
    ${c.cta ? `<a href="${c.ctaLink || "#"}" class="inline-block border-2 border-current px-8 py-3 text-sm tracking-widest uppercase hover:opacity-80 transition">${c.cta}</a>` : ""}
  </div>
</section>`;
}
__name(hero, "hero");
function hero_carousel(c) {
  const slides = c.slides || [{ headline: "Welcome" }];
  return `
<section class="relative overflow-hidden">
  <div class="flex">
    ${slides.map((s, i) => `
    <div class="min-w-full min-h-[70vh] flex items-center justify-center py-20 px-6 ${i === 0 ? "" : "hidden"}">
      <div class="text-center">
        <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-4">${s.headline || ""}</h1>
        ${s.subtext ? `<p class="text-lg opacity-70 mb-8">${s.subtext}</p>` : ""}
        ${s.cta ? `<a href="${s.ctaLink || "#"}" class="inline-block border-2 border-current px-8 py-3 text-sm tracking-widest uppercase hover:opacity-80 transition">${s.cta}</a>` : ""}
      </div>
    </div>`).join("")}
  </div>
</section>`;
}
__name(hero_carousel, "hero_carousel");
function product_grid(c, products) {
  const cols = c.columns || 2;
  const items = products?.length ? products : c.products || [];
  const title = c.title || "";
  const cards = items.length ? items.map((p) => `
    <div class="group">
      <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
        <img src="${p.imageUrl || `https://placehold.co/600x800/EEE/999?text=${encodeURIComponent(p.name || "Item")}`}" alt="${p.name || ""}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      </div>
      <p class="text-sm font-medium">${p.name || "Item"}</p>
      ${p.price != null ? `<p class="text-sm opacity-60 mt-1">\u20B9${p.price}</p>` : ""}
    </div>`).join("") : `<p class="col-span-full text-center opacity-40 text-sm">No products yet</p>`;
  return `
<section class="px-6 py-16">
  ${title ? `<h2 class="text-2xl font-bold tracking-widest uppercase text-center mb-12">${title}</h2>` : ""}
  <div class="grid grid-cols-2 md:grid-cols-${cols} gap-6 max-w-6xl mx-auto">${cards}</div>
</section>`;
}
__name(product_grid, "product_grid");
function product_carousel(c, products) {
  const items = products?.length ? products : c.products || [];
  const cards = items.map((p) => `
  <div class="min-w-[200px] flex-shrink-0">
    <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-3">
      <img src="${p.imageUrl || `https://placehold.co/600x800/EEE/999?text=${encodeURIComponent(p.name || "Item")}`}" alt="${p.name || ""}" class="w-full h-full object-cover" loading="lazy" />
    </div>
    <p class="text-sm font-medium">${p.name || "Item"}</p>
    ${p.price != null ? `<p class="text-sm opacity-60 mt-1">\u20B9${p.price}</p>` : ""}
  </div>`).join("");
  return `
<section class="px-6 py-16">
  <div class="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">${cards}</div>
</section>`;
}
__name(product_carousel, "product_carousel");
function lookbook_grid(c) {
  const images = c.images || [];
  const cols = c.columns || 2;
  const cells = images.map((img) => `
  <div class="relative aspect-[3/4] overflow-hidden">
    <img src="${img.imageUrl || "https://placehold.co/600x800/EEE/999"}" alt="${img.caption || ""}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
    ${img.caption ? `<p class="absolute bottom-3 left-3 text-xs tracking-widest uppercase text-white drop-shadow">${img.caption}</p>` : ""}
  </div>`).join("");
  return `
<section class="px-6 py-16">
  <div class="grid grid-cols-2 md:grid-cols-${cols} gap-1 max-w-6xl mx-auto">${cells}</div>
</section>`;
}
__name(lookbook_grid, "lookbook_grid");
function testimonials(c) {
  const items = c.items || [];
  const headline = c.headline || "What People Say";
  const cards = items.map((t) => `
  <div class="bg-gray-50 p-8 text-center">
    ${t.rating ? `<div class="mb-4">${"\u2605".repeat(t.rating)}${"\u2606".repeat(5 - t.rating)}</div>` : ""}
    <p class="text-sm italic leading-relaxed mb-6">"${t.quote || ""}"</p>
    <p class="text-xs font-semibold tracking-wide uppercase">${t.author || "Anonymous"}</p>
    ${t.role ? `<p class="text-xs opacity-50 mt-1">${t.role}</p>` : ""}
  </div>`).join("");
  return `
<section class="px-6 py-16">
  <h2 class="text-2xl font-bold tracking-widest uppercase text-center mb-12">${headline}</h2>
  <div class="grid md:grid-cols-${Math.min(items.length, 3)} gap-6 max-w-5xl mx-auto">${cards}</div>
</section>`;
}
__name(testimonials, "testimonials");
function newsletter(c) {
  return `
<section class="px-6 py-20 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-4">${c.headline || "Stay in the Loop"}</h2>
  <p class="text-sm opacity-60 mb-8 max-w-md mx-auto">${c.subtext || "Get the latest drops and stories delivered to your inbox."}</p>
  <form class="flex max-w-md mx-auto gap-0">
    <input type="email" placeholder="${c.placeholder || "Enter your email"}" class="flex-1 px-4 py-3 bg-transparent border border-current text-sm outline-none" />
    <button type="submit" class="px-6 py-3 text-sm font-semibold tracking-wider uppercase hover:opacity-90 transition">${c.buttonText || "Subscribe"}</button>
  </form>
</section>`;
}
__name(newsletter, "newsletter");
function promo_tiles(c) {
  const tiles = c.tiles || [];
  const cells = tiles.map((t) => `
  <a href="${t.href || "#"}" class="relative aspect-[4/5] overflow-hidden block">
    <img src="${t.imageUrl || "https://placehold.co/600x750/EEE/999"}" alt="${t.title || ""}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
      <p class="text-white text-lg font-bold tracking-widest uppercase">${t.title || ""}</p>
    </div>
  </a>`).join("");
  return `
<section class="px-6 py-16">
  <div class="grid grid-cols-2 gap-1 max-w-6xl mx-auto">${cells}</div>
</section>`;
}
__name(promo_tiles, "promo_tiles");
function category_row(c) {
  const categories = c.categories || [];
  const items = categories.map((cat) => `
  <a href="${cat.href || "#"}" class="text-center flex-shrink-0 w-28">
    <div class="w-28 h-28 rounded-full overflow-hidden bg-gray-100 mb-3 mx-auto">
      ${cat.imageUrl ? `<img src="${cat.imageUrl}" alt="${cat.name || ""}" class="w-full h-full object-cover" loading="lazy" />` : ""}
    </div>
    <p class="text-xs font-medium tracking-wider uppercase">${cat.name || ""}</p>
  </a>`).join("");
  return `
<section class="px-6 py-16">
  <div class="flex gap-8 justify-center overflow-x-auto pb-4">${items}</div>
</section>`;
}
__name(category_row, "category_row");
function rich_text(c) {
  const align = c.align || "left";
  const maxW = align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : "";
  return `
<section class="px-6 py-16">
  <div class="max-w-3xl ${maxW}">
    <p class="text-base leading-relaxed opacity-80">${c.text || ""}</p>
  </div>
</section>`;
}
__name(rich_text, "rich_text");
function brand_story(c) {
  const align = c.align || "image-left";
  const imageCol = c.imageUrl ? `<div class="flex-1 min-h-[300px]"><img src="${c.imageUrl}" alt="${c.heading || ""}" class="w-full h-full object-cover" loading="lazy" /></div>` : `<div class="flex-1 min-h-[300px] bg-gray-100"></div>`;
  const textCol = `
<div class="flex-1 flex flex-col justify-center px-8 py-16">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-6">${c.heading || "Our Story"}</h2>
  <p class="text-sm leading-relaxed opacity-70 mb-8">${c.body || ""}</p>
  ${c.cta ? `<a href="${c.ctaLink || "#"}" class="self-start border border-current px-6 py-3 text-xs tracking-widest uppercase hover:opacity-80 transition">${c.cta}</a>` : ""}
</div>`;
  return `
<section class="flex flex-wrap">
  ${align === "image-right" ? `${textCol}${imageCol}` : `${imageCol}${textCol}`}
</section>`;
}
__name(brand_story, "brand_story");
function social_proof(c) {
  const stats = c.stats || [{ value: c.metric || "10,000+", label: c.label || "Happy Customers" }];
  const items = stats.map((s) => `
  <div class="text-center px-8 py-4">
    <p class="text-4xl md:text-5xl font-bold">${s.value}</p>
    <p class="text-xs tracking-widest uppercase opacity-50 mt-2">${s.label}</p>
  </div>`).join("");
  return `
<section class="px-6 py-16">
  <div class="flex flex-wrap justify-center max-w-4xl mx-auto">${items}</div>
</section>`;
}
__name(social_proof, "social_proof");
function countdown(c) {
  const target = c.targetDate || new Date(Date.now() + 7 * 864e5).toISOString();
  return `
<section class="px-6 py-20 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase mb-12">${c.label || "Coming Soon"}</h2>
  <div class="flex gap-8 justify-center flex-wrap">
    <div><p class="text-5xl font-bold" id="cd-d">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Days</p></div>
    <div><p class="text-5xl font-bold" id="cd-h">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Hours</p></div>
    <div><p class="text-5xl font-bold" id="cd-m">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Min</p></div>
    <div><p class="text-5xl font-bold" id="cd-s">--</p><p class="text-xs tracking-widest uppercase opacity-50 mt-2">Sec</p></div>
  </div>
  <script>(function(){var t=new Date('${target}').getTime();function u(){var d=Math.max(0,t-Date.now()),dd=Math.floor(d/864e5),hh=Math.floor(d%864e5/36e5),mm=Math.floor(d%36e5/6e4),ss=Math.floor(d%6e4/1e3);var D=document.getElementById('cd-d'),H=document.getElementById('cd-h'),M=document.getElementById('cd-m'),S=document.getElementById('cd-s');if(D)D.textContent=dd<10?'0'+dd:dd;if(H)H.textContent=hh<10?'0'+hh:hh;if(M)M.textContent=mm<10?'0'+mm:mm;if(S)S.textContent=ss<10?'0'+ss:ss;if(d>0)requestAnimationFrame(u)}u()})();<\/script>
</section>`;
}
__name(countdown, "countdown");
function section_header(c) {
  return `
<section class="px-6 py-16 text-center">
  <h2 class="text-2xl font-bold tracking-widest uppercase">${c.title || "Collection"}</h2>
  ${c.subtitle ? `<p class="text-sm opacity-50 mt-3 max-w-md mx-auto">${c.subtitle}</p>` : ""}
</section>`;
}
__name(section_header, "section_header");
function announcement_bar(c) {
  return `
<div class="text-center py-2.5 px-6 text-xs tracking-widest uppercase font-medium">
  ${c.text ? c.link ? `<a href="${c.link}" class="no-underline">${c.text}</a>` : c.text : "Free shipping on orders over \u20B9999"}
</div>`;
}
__name(announcement_bar, "announcement_bar");
function footer(c) {
  const links = c.links || [];
  const linksHtml = links.map((l) => `<a href="${l.href || "#"}" class="text-xs opacity-60 hover:opacity-100 transition no-underline">${l.label}</a>`).join('<span class="opacity-20 mx-3">\xB7</span>');
  return `
<footer class="text-center py-16 px-6">
  <div class="flex justify-center flex-wrap gap-0 mb-8">${linksHtml}</div>
  <p class="text-xs opacity-30">&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} All rights reserved</p>
</footer>`;
}
__name(footer, "footer");

// src/renderer.ts
var TEMPLATES = {
  "streetwear-dark": `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`,
  "luxury-black": `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}
h1,h2,h3{font-family:var(--fontHeading),serif}</style>
</head><body><!-- SECTIONS --></body></html>`,
  "minimal-white": `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}
a{color:inherit;text-decoration:none}</style>
</head><body><!-- SECTIONS --></body></html>`,
  "modern-gradient": `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`,
  "editorial": `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`
};
function renderSections(sections, products) {
  return sections.map((section) => {
    const renderer = SECTION_RENDERERS[section.type];
    if (!renderer)
      return `<!-- unknown section: ${section.type} -->`;
    return renderer(section.config || {}, products);
  }).join("\n");
}
__name(renderSections, "renderSections");
function replaceVars(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
__name(replaceVars, "replaceVars");
async function renderStorefront(layout, storeName, products) {
  const template = TEMPLATES[layout.template] || TEMPLATES["streetwear-dark"];
  const sectionsHtml = renderSections(layout.sections, products);
  let html = template.replace("<!-- SECTIONS -->", sectionsHtml);
  html = replaceVars(html, {
    name: storeName,
    primary: layout.theme.primary,
    background: layout.theme.background,
    text: layout.theme.text,
    font: layout.theme.font,
    fontHeading: layout.theme.fontHeading
  });
  return html;
}
__name(renderStorefront, "renderStorefront");

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const storeMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
    if (!storeMatch) {
      return new Response("Not found", { status: 404 });
    }
    const storeSlug = storeMatch[1];
    const isPreview = url.pathname === "/preview";
    try {
      if (!isPreview) {
        const cached = await env.STOREFRONT_CACHE.get(`html:${storeSlug}`);
        if (cached) {
          return new Response(cached, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      }
      const layout = await readLayout(env, storeSlug);
      if (!layout) {
        return new Response("Store not found", { status: 404 });
      }
      const products = await readProducts(env, storeSlug);
      const html = await renderStorefront(layout, storeSlug, products);
      if (!isPreview) {
        ctx.waitUntil(
          env.STOREFRONT_CACHE.put(`html:${storeSlug}`, html, { expirationTtl: 300 })
        );
      }
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": isPreview ? "no-cache" : "public, max-age=300"
        }
      });
    } catch (err) {
      console.error(`[Storefront] Error for ${storeSlug}:`, err);
      return new Response("Internal error", { status: 500 });
    }
  }
};
async function readLayout(env, storeSlug) {
  const result = await tursoQuery(
    env,
    `SELECT data FROM matter
     WHERE form IN (SELECT id FROM form WHERE data LIKE ? AND type = 'store' AND active = 1)
     AND type = 'storefront_published' AND active = 1
     LIMIT 1`,
    [`%"subdomain":"${storeSlug}"%`]
  );
  if (result.rows?.length) {
    try {
      return JSON.parse(result.rows[0].data);
    } catch {
    }
  }
  const draft = await tursoQuery(
    env,
    `SELECT data FROM matter
     WHERE form IN (SELECT id FROM form WHERE data LIKE ? AND type = 'store' AND active = 1)
     AND type = 'storefront_draft' AND active = 1
     LIMIT 1`,
    [`%"subdomain":"${storeSlug}"%`]
  );
  if (draft.rows?.length) {
    try {
      return JSON.parse(draft.rows[0].data);
    } catch {
    }
  }
  return null;
}
__name(readLayout, "readLayout");
async function readProducts(env, storeSlug) {
  const result = await tursoQuery(
    env,
    `SELECT f.title, m.value, m.data
     FROM matter m
     JOIN graph g ON g.src = m.id AND g.type = 'belongs_to'
     JOIN form f ON f.id = m.form
     JOIN form store ON store.id = g.tgt
     WHERE store.data LIKE ? AND store.type = 'store' AND store.active = 1
     AND m.type = 'stock' AND m.active = 1`,
    [`%"subdomain":"${storeSlug}"%`]
  );
  return (result.rows || []).map((row) => {
    let imageUrl;
    try {
      const data = JSON.parse(row.data || "{}");
      imageUrl = data.imageUrl;
    } catch {
    }
    return {
      name: row.title || "Item",
      price: row.value ?? null,
      imageUrl
    };
  });
}
__name(readProducts, "readProducts");
async function tursoQuery(env, sql, args = []) {
  const res = await fetch(env.TURSO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, args })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Turso query failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}
__name(tursoQuery, "tursoQuery");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-JaNyo6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-JaNyo6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
