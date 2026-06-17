/**
 * Storefront Worker — multi-tenant edge renderer for tarai.space
 *
 * Reads DIRECTLY from the shared global Turso DB (the same DB the app's
 * s3storage /api/publish endpoint writes to). No mirror, no sync — always live.
 *
 * Routes by hostname:
 *   <sub>.tarai.space   -> that user's storefront
 *   market.tarai.space  -> global marketplace (all public matter)
 *   /api/store/:sub      -> storefront JSON
 *   /api/market          -> marketplace JSON
 *
 * Data model (global Turso): matter (id, code, type, scope, owner, title,
 * public, data, time) + mass (value=price, qty=stock, matter=productId).
 * A storefront lists products via relation(src=storeId, tgt=productId,
 * type='lists'); if a store has no such relations we fall back to
 * everything owned by the store owner.
 *
 * KV (STORES) caches subdomain -> {storeId, owner} to avoid a lookup query.
 */

export interface Env {
  STORES: KVNamespace;
  TURSO_URL: string;        // libsql://global-tarframework... (secret)
  TURSO_AUTH_TOKEN: string; // secret
}

// --- Turso HTTP client (same shape as s3storage queryTurso) ---
async function turso(env: Env, sql: string, params: any[] = []): Promise<any[]> {
  const httpUrl = env.TURSO_URL.replace("libsql://", "https://");
  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: params.map((p) =>
              p === null || p === undefined
                ? { type: "null" }
                : typeof p === "number"
                ? { type: "float", value: p }
                : { type: "text", value: String(p) }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Turso ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const r = data.results?.[0];
  if (r?.type === "error") throw new Error(r.error.message);
  const result = r?.response?.result;
  if (!result) return [];
  // Map Turso's columnar rows -> array of plain objects.
  const cols: string[] = result.cols.map((c: any) => c.name);
  return result.rows.map((row: any[]) => {
    const o: any = {};
    row.forEach((cell, i) => (o[cols[i]] = cell?.value ?? null));
    return o;
  });
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const host = url.hostname;
    const sub = host.split(".")[0];

    try {
      if (url.pathname.startsWith("/api/store/")) {
        return await getStoreJson(env, decodeURIComponent(url.pathname.split("/")[3]));
      }
      if (url.pathname.startsWith("/api/market")) {
        return await getMarketJson(env, url);
      }
      if (url.pathname.startsWith("/api/product/")) {
        return await getProductJson(env, decodeURIComponent(url.pathname.split("/")[3]));
      }
      // Product detail page: /p/:id  (works on a storefront subdomain or market)
      if (url.pathname.startsWith("/p/")) {
        const id = decodeURIComponent(url.pathname.split("/")[2] || "");
        const store = host.endsWith("tarai.space") && sub !== "market" && sub !== "tarai" && sub !== "www"
          ? await resolveStore(env, sub)
          : null;
        return await renderProduct(env, store, id);
      }
      if (sub === "market") {
        return await renderMarket(env, url);
      }
      if (host.endsWith("tarai.space") && sub !== "tarai" && sub !== "www") {
        return await renderStorefront(env, sub);
      }
      return html(`<h1>tarai storefronts</h1><p>Visit <code>yourshop.tarai.space</code> or <a href="https://market.tarai.space">the marketplace</a>.</p>`);
    } catch (e: any) {
      return html(`<pre>error: ${esc(e.message)}</pre>`, 500);
    }
  },
};

// --- Resolve a subdomain to a store matter (KV cache -> Turso) ---
async function resolveStore(env: Env, sub: string): Promise<any | null> {
  const cached = await env.STORES.get(sub, "json").catch(() => null);
  if (cached) return cached;

  // A storefront is a published 'profile' matter. Match by data.subdomain,
  // else by code or id == sub (so a profile works even before a subdomain is set).
  const rows = await turso(
    env,
    `SELECT * FROM matter
     WHERE type='profile' AND public=1
       AND (json_extract(data,'$.subdomain')=? OR lower(code)=lower(?) OR id=?)
     LIMIT 1`,
    [sub, sub, sub]
  );
  const store = rows[0] ?? null;
  if (store) await env.STORES.put(sub, JSON.stringify(store), { expirationTtl: 300 });
  return store;
}

// --- Products a storefront shows ---
// App model: relation(src=product, tgt=profile, type='published_to').
// Fall back to everything the profile owner published if none are linked yet.
async function storeProducts(env: Env, store: any): Promise<any[]> {
  const linked = await turso(
    env,
    `SELECT m.*, MIN(ms.value) AS price, SUM(ms.qty) AS qty
     FROM relation r
     JOIN matter m ON m.id = r.src
     LEFT JOIN mass ms ON ms.matter = m.id AND ms.active = 1
     WHERE r.tgt = ? AND r.type = 'published_to' AND m.public = 1
     GROUP BY m.id
     ORDER BY MAX(r.weight) DESC`,
    [store.id]
  );
  if (linked.length) return linked;

  // Fallback: no explicit listings yet -> show everything this owner published.
  return turso(
    env,
    `SELECT m.*, MIN(ms.value) AS price, SUM(ms.qty) AS qty
     FROM matter m
     LEFT JOIN mass ms ON ms.matter = m.id AND ms.active = 1
     WHERE m.owner = ? AND m.type = 'product' AND m.public = 1
     GROUP BY m.id
     ORDER BY m.time DESC`,
    [store.owner]
  );
}

// --- JSON reads ---
async function getStoreJson(env: Env, sub: string) {
  const store = await resolveStore(env, sub);
  if (!store) return json({ error: "not found" }, 404);
  return json({ store, products: await storeProducts(env, store) });
}

async function getMarketJson(env: Env, url: URL) {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const type = url.searchParams.get("type"); // optional filter: product, hotel, ...
  const products = await turso(
    env,
    `SELECT m.*, MIN(ms.value) AS price FROM matter m
     LEFT JOIN mass ms ON ms.matter=m.id AND ms.active=1
     WHERE m.public=1 AND m.type=?
     GROUP BY m.id ORDER BY m.time DESC LIMIT ?`,
    [type || "product", limit]
  );
  return json({ products });
}

// --- Single product (by id), with collapsed price/stock ---
async function getProduct(env: Env, id: string): Promise<any | null> {
  const rows = await turso(
    env,
    `SELECT m.*, MIN(ms.value) AS price, SUM(ms.qty) AS qty
     FROM matter m
     LEFT JOIN mass ms ON ms.matter = m.id AND ms.active = 1
     WHERE m.id = ? AND m.public = 1
     GROUP BY m.id
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getProductJson(env: Env, id: string) {
  const product = await getProduct(env, id);
  if (!product) return json({ error: "not found" }, 404);
  return json({ product });
}

// --- HTML renders ---
function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function parseData(p: any): any {
  try { return JSON.parse(p.data ?? "{}"); } catch { return {}; }
}

function firstImage(p: any): string {
  const d = parseData(p);
  return (d.images ?? [])[0] ?? d.image ?? d.img ?? "";
}

// Price source of truth = matter.data.price (what you edit in the matter table).
// Fall back to the mass-derived value only when data has no price.
function priceOf(p: any): number | null {
  const d = parseData(p);
  if (d.price != null && d.price !== "") return Number(d.price);
  return p.price != null ? Number(p.price) : null;
}

function productCard(p: any) {
  const img = firstImage(p);
  const price = priceOf(p);
  return `<a class="card" href="/p/${encodeURIComponent(p.id)}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div class="ph"></div>`}
    <div class="meta"><b>${esc(p.title)}</b><span>${price != null ? "₹" + esc(price) : ""}</span></div>
  </a>`;
}

// Storefront contact for ordering: profile data.whatsapp/phone, else product data.
function orderPhone(store: any, product: any): string {
  const sd = store ? parseData(store) : {};
  const pd = parseData(product);
  const raw = sd.whatsapp || sd.phone || pd.whatsapp || pd.phone || "";
  return String(raw).replace(/[^\d]/g, ""); // wa.me wants digits only (with country code)
}

function orderButton(store: any, product: any): string {
  const phone = orderPhone(store, product);
  const price = priceOf(product);
  const shopName = store?.title ? ` from ${store.title}` : "";
  const text = `Hi! I'd like to order "${product.title}"${price != null ? ` (₹${price})` : ""}${shopName}.`;
  if (phone) {
    const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    return `<a class="order" href="${esc(href)}" target="_blank" rel="noopener">Order on WhatsApp</a>`;
  }
  // No phone configured -> mailto fallback so the button is never dead.
  return `<a class="order alt" href="mailto:?subject=${encodeURIComponent("Order: " + product.title)}&body=${encodeURIComponent(text)}">Enquire to order</a>`;
}

const shell = (title: string, inner: string, theme: any = {}) => `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{--accent:${esc(theme.color || "#111")}}
  *{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#111}
  header{padding:24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px}
  header img{height:36px}h1{font-size:20px;margin:0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;padding:24px}
  .card{border:1px solid #eee;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block;transition:box-shadow .15s}
  .card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .card img,.ph{width:100%;aspect-ratio:1;object-fit:cover;background:#f3f3f3;display:block}
  .meta{padding:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .meta b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .meta span{color:var(--accent);font-weight:600;white-space:nowrap}
  .pd{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:24px;max-width:920px;margin:0 auto}
  @media(max-width:640px){.pd{grid-template-columns:1fr;gap:16px}}
  .pd img,.pd .ph{width:100%;border-radius:12px;aspect-ratio:1;object-fit:cover;background:#f3f3f3}
  .pd h2{margin:0 0 8px;font-size:24px}
  .pd .price{color:var(--accent);font-size:24px;font-weight:700;margin:8px 0}
  .pd .desc{color:#444;white-space:pre-wrap;margin:12px 0}
  .pd .stock{color:#888;font-size:14px;margin-bottom:16px}
  .order{display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600}
  .order.alt{background:var(--accent)}
  .back{display:inline-block;margin:16px 24px 0;color:#888;text-decoration:none;font-size:14px}
  footer{padding:24px;color:#999;font-size:13px}
</style></head><body>${inner}
<footer>Powered by tarai.space</footer></body></html>`;

async function renderStorefront(env: Env, sub: string) {
  const store = await resolveStore(env, sub);
  if (!store) return html(shell("Not found", `<header><h1>Store not found</h1></header>`), 404);
  let theme: any = {};
  try { theme = JSON.parse(store.data ?? "{}").theme ?? JSON.parse(store.data ?? "{}"); } catch {}
  const products = await storeProducts(env, store);
  const header = `<header>${theme.logo ? `<img src="${esc(theme.logo)}">` : ""}<h1>${esc(store.title || sub)}</h1></header>`;
  const grid = products.length
    ? `<div class="grid">${products.map(productCard).join("")}</div>`
    : `<p style="padding:24px">No products yet.</p>`;
  return html(shell(store.title || sub, header + grid, theme));
}

async function renderMarket(env: Env, url: URL) {
  const rows = await turso(
    env,
    `SELECT m.*, MIN(ms.value) AS price FROM matter m
     LEFT JOIN mass ms ON ms.matter=m.id AND ms.active=1
     WHERE m.public=1 AND m.type='product'
     GROUP BY m.id ORDER BY m.time DESC LIMIT 100`
  );
  const grid = `<div class="grid">${rows.map(productCard).join("")}</div>`;
  return html(shell("Marketplace · tarai", `<header><h1>Marketplace</h1></header>${grid}`));
}

// --- Product detail page ---
// `store` is the storefront profile when visited under <sub>.tarai.space, else null
// (e.g. on market.tarai.space) — it supplies branding + the order contact.
async function renderProduct(env: Env, store: any, id: string) {
  const product = await getProduct(env, id);
  if (!product) {
    return html(shell("Not found", `<header><h1>Product not found</h1></header><a class="back" href="/">← Back</a>`), 404);
  }
  let theme: any = {};
  if (store) { try { theme = JSON.parse(store.data ?? "{}").theme ?? {}; } catch {} }

  const d = parseData(product);
  const img = firstImage(product);
  const price = priceOf(product);
  const qty = product.qty != null ? Number(product.qty) : null;
  const desc = d.description ?? d.desc ?? d.about ?? "";
  const title = store?.title || "Marketplace";
  const logo = theme.logo ? `<img src="${esc(theme.logo)}">` : "";

  const body = `
    <header>${logo}<h1>${esc(title)}</h1></header>
    <a class="back" href="/">← Back to ${esc(store ? "shop" : "marketplace")}</a>
    <div class="pd">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph"></div>`}
      <div>
        <h2>${esc(product.title)}</h2>
        ${price != null ? `<div class="price">₹${esc(price)}</div>` : ""}
        ${qty != null ? `<div class="stock">${qty > 0 ? esc(qty) + " in stock" : "Out of stock"}</div>` : ""}
        ${desc ? `<div class="desc">${esc(desc)}</div>` : ""}
        ${orderButton(store, product)}
      </div>
    </div>`;
  return html(shell(product.title || "Product", body, theme));
}
