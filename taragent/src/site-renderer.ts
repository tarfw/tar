import { readWorkspaceFile, readWithFallback } from './lib/okf';
import { parseDesignMD } from './lib/design-md-parser';
import { dbContext } from './lib/db';
import { getOrCreateWorkspaceDb } from './lib/workspace-db';
import { executeRead } from './lib/helpers';
import { getActiveRevision } from './gen-ui/validator';
import { renderSiteToHtml } from './gen-site/SiteRenderer';
import { loadDesign } from './gen-ui/design-loader';
import { renderSectionsToHtml } from './gen-ui/renderer';
import './gen-site/registry/builtins'; // Register web components

export async function handleSiteRequest(
  env: any,
  workspaceSlug: string,
  pathname: string,
  method: string,
  request: Request
): Promise<Response> {
  const scope = `w:${workspaceSlug}`;

  // Resolve workspace name from D1
  let wsName = workspaceSlug;
  try {
    const ws = await env.DB?.prepare('SELECT name FROM workspaces WHERE subdomain = ?')
      .bind(workspaceSlug).first();
    if (ws?.name) wsName = ws.name;
  } catch {}

  // 0. Try section-based rendering from S3 home.json (new system)
  try {
    const homeJsonRaw = await readWorkspaceFile(env, scope, 'site/layouts/home.json');
    if (homeJsonRaw) {
      const homeJson = JSON.parse(homeJsonRaw);
      const design = await loadDesign(env, scope, workspaceSlug).catch(() => null);
      const tokens = design?.tokens || {
        colors: { primary: '#1B4332', secondary: '#2D6A4F', tertiary: '#D4A373', neutral: '#FFFFFF' },
        typography: { body: { fontFamily: 'Inter' }, h1: { fontFamily: 'Inter' } },
        rounded: { sm: '6px', md: '12px', lg: '16px' },
        spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px' },
      };
      const templateName = homeJson.template || (design as any)?.template || (design as any)?.preset || '';
      if (!homeJson.template && templateName) {
        homeJson.template = templateName;
      }
      const html = renderSectionsToHtml({
        plan: homeJson,
        tokens,
        workspaceName: wsName,
      });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  } catch (err) {
    console.warn('[site-renderer] S3 home.json render failed:', err);
  }

  // 1. Try registered SiteLayout revision
  try {
    const plan = await getActiveRevision(workspaceSlug, 'web', env);
    if (plan) {
      const design = await loadDesign(env, scope, workspaceSlug);
      const html = renderSectionsToHtml({
        plan,
        tokens: {
          colors: design.tokens.colors,
          typography: design.tokens.typography,
          rounded: design.tokens.rounded,
          spacing: design.tokens.spacing,
        },
        workspaceName: workspaceSlug,
      });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  } catch (err) {
    console.warn('[site-renderer] Registered revision render failed:', err);
  }

  // 1. Check KV cache for DESIGN.md + site/pages.md config
  const cacheKey = `site_config:${workspaceSlug}`;
  let siteConfig: { designText: string; pagesText: string } | null = null;
  
  if (env.STOREFRONT_CACHE) {
    try {
      const cached = await env.STOREFRONT_CACHE.get(cacheKey);
      if (cached) siteConfig = JSON.parse(cached);
    } catch {}
  }

  if (!siteConfig) {
    const designText = await readWorkspaceFile(env, scope, 'DESIGN.md');
    const pagesText = await readWorkspaceFile(env, scope, 'site/pages.md');
    
    if (!designText || !pagesText) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Setting up</title></head><body><div style="font-family:sans-serif;text-align:center;padding:100px;"><h1>Setting up</h1><p>The workspace ${workspaceSlug} is currently being initialized.</p></div></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    siteConfig = { designText, pagesText };
    if (env.STOREFRONT_CACHE) {
      await env.STOREFRONT_CACHE.put(cacheKey, JSON.stringify(siteConfig), { expirationTtl: 300 });
    }
  }

  // 2. Parse configs
  const designTokens = parseDesignMD(siteConfig.designText);
  
  // Extract pages list from pagesText yaml
  const pages: Array<{ slug: string; template: string; data_source: string; module: string }> = [];
  try {
    const lines = siteConfig.pagesText.split('\n');
    let inYaml = false;
    let yamlText = '';
    for (const line of lines) {
      if (line.trim() === '---') {
        inYaml = !inYaml;
        continue;
      }
      if (inYaml) yamlText += line + '\n';
    }
    
    // Parse simple yaml list of page maps
    const pageBlocks = yamlText.split('- slug:').slice(1);
    for (const block of pageBlocks) {
      if (!block.trim()) continue;
      const slugLine = block.split('\n')[0].trim();
      const slug = ('/' + slugLine.replace(/^['"]|['"]$/g, '')).replace(/^\/\//, '/');
      const templateMatch = block.match(/template:\s*([a-zA-Z0-9-]+)/);
      const dataSourceMatch = block.match(/data_source:\s*["']?([^"'\n]+)["']?/);
      const moduleMatch = block.match(/module:\s*([a-zA-Z0-9-]+)/);
      
      if (slug) {
        pages.push({
          slug,
          template: templateMatch ? templateMatch[1].trim() : 'hero',
          data_source: dataSourceMatch ? dataSourceMatch[1].trim() : '',
          module: moduleMatch ? moduleMatch[1].trim() : '',
        });
      }
    }
  } catch (err) {
    console.warn('[site-renderer] Failed to parse site pages:', err);
  }

  // Match current path
  let targetPath = pathname;
  if (targetPath === '/' && pages.length > 0) {
    // Fallback to first page or look for a / index page
    const homePage = pages.find(p => p.slug === '/');
    targetPath = homePage ? '/' : pages[0].slug;
  }

  const matchedPage = pages.find(p => p.slug === targetPath);
  if (!matchedPage) {
    return new Response('Page not found', { status: 404 });
  }

  // 3. Resolve Database connection for Workspace
  let dbUrl = '';
  let dbToken = '';
  if (env.DB) {
    try {
      const ws = await env.DB.prepare(
        'SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(workspaceSlug).first();

      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(env.DB, workspaceSlug, scope, env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    } catch {}
  }

  // 4. Fetch dynamic data if query exists
  let items: any[] = [];
  if (dbUrl && matchedPage.data_source) {
    try {
      await dbContext.run({ url: dbUrl, token: dbToken }, async () => {
        // e.g. "matter WHERE type = 'product'" -> parsed as read operation
        const typeMatch = matchedPage.data_source.match(/type\s*=\s*['"]([^'"]+)['"]/);
        const type = typeMatch ? typeMatch[1] : 'product';
        const res = await executeRead({ table: 'matter', type, scope }) as any;
        if (res && res.rows) {
          items = res.rows;
        }
      });
    } catch (err) {
      console.warn('[site-renderer] Database read failed:', err);
    }
  }

  // 5. Generate CSS styles from DESIGN.md
  const styles = `
    :root {
      --primary: ${designTokens.colors.primary || '#1B4332'};
      --secondary: ${designTokens.colors.secondary || '#2D6A4F'};
      --tertiary: ${designTokens.colors.tertiary || '#D4A373'};
      --neutral: ${designTokens.colors.neutral || '#FEFAE0'};
      --on-primary: ${designTokens.colors['on-primary'] || '#FFFFFF'};
      
      --rounded-sm: ${designTokens.rounded.sm || '6px'};
      --rounded-md: ${designTokens.rounded.md || '12px'};
      --rounded-lg: ${designTokens.rounded.lg || '16px'};
      
      --spacing-xs: ${designTokens.spacing.xs || '4px'};
      --spacing-sm: ${designTokens.spacing.sm || '8px'};
      --spacing-md: ${designTokens.spacing.md || '16px'};
      --spacing-lg: ${designTokens.spacing.lg || '24px'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--neutral);
      color: var(--primary);
      font-family: "${designTokens.typography['body-md']?.fontFamily || 'Inter'}", sans-serif;
      line-height: 1.5;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "${designTokens.typography.h1?.fontFamily || 'Outfit'}", sans-serif;
      font-weight: 700;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: var(--spacing-lg); }
    .header { display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid rgba(0,0,0,0.05); }
    .nav { display: flex; gap: var(--spacing-md); }
    .nav-link { text-decoration: none; color: var(--primary); font-weight: 500; }
    .nav-link:hover { color: var(--tertiary); }
    .btn { background: var(--tertiary); color: var(--on-primary); border: none; padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--rounded-sm); cursor: pointer; text-decoration: none; font-weight: 600; display: inline-block; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--spacing-lg); margin-top: var(--spacing-lg); }
    .card { background: white; border-radius: var(--rounded-md); overflow: hidden; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); display: flex; flex-direction: column; }
    .card-body { padding: var(--spacing-md); display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between; }
    .card-title { font-size: 1.2rem; margin-bottom: var(--spacing-xs); }
    .card-price { font-weight: 700; color: var(--tertiary); font-size: 1.1rem; margin-bottom: var(--spacing-sm); }
    .footer { text-align: center; padding: var(--spacing-lg); font-size: 0.85rem; color: rgba(0,0,0,0.5); margin-top: 80px; }
  `;

  // 6. Build Navigation HTML
  const navHtml = pages
    .map(p => `<a href="${p.slug}" class="nav-link">${p.slug.replace('/', '').toUpperCase() || 'HOME'}</a>`)
    .join('\n');

  // 7. Render matching template
  let pageContent = '';
  let scriptWidget = '';

  if (matchedPage.template === 'hero') {
    pageContent = `
      <div style="text-align: center; padding: 80px 20px; max-width: 800px; margin: 0 auto;">
        <h1 style="font-size: 3rem; margin-bottom: var(--spacing-md);">${designTokens.name}</h1>
        <p style="font-size: 1.25rem; color: rgba(0,0,0,0.6); margin-bottom: var(--spacing-lg);">Welcome to our custom workspace site. Explore our menu, book services, or contact us below.</p>
        <div style="display: flex; gap: var(--spacing-md); justify-content: center;">
          ${pages.filter(p => p.slug !== '/').map(p => `<a href="${p.slug}" class="btn">${p.slug.replace('/', '').toUpperCase()}</a>`).join('')}
        </div>
      </div>
    `;
  } else if (matchedPage.template === 'catalog-grid') {
    const cards = items
      .map(
        i => `
      <div class="card">
        <div style="height: 200px; background: var(--secondary); display: flex; align-items: center; justify-content: center; color: white;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div class="card-body">
          <div>
            <h3 class="card-title">${i.title || 'Product'}</h3>
            <p style="color:rgba(0,0,0,0.6);font-size:0.9rem;margin-bottom:var(--spacing-sm);">${i.data?.description || 'Quality product'}</p>
          </div>
          <div>
            <div class="card-price">$${i.value || '0.00'}</div>
            <button class="btn add-to-cart-btn" data-id="${i.id}" data-title="${i.title}" data-price="${i.value || 0}">Add to Cart</button>
          </div>
        </div>
      </div>`
      )
      .join('\n');

    pageContent = `
      <div class="container">
        <h2>Our Menu & Products</h2>
        <div class="grid">${cards || '<p>No items found in catalog.</p>'}</div>
      </div>
    `;

    scriptWidget = `
      // Cart system
      let cart = JSON.parse(localStorage.getItem('cart') || '[]');
      document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const title = btn.getAttribute('data-title');
          const price = parseFloat(btn.getAttribute('data-price'));
          const existing = cart.find(x => x.id === id);
          if (existing) {
            existing.qty++;
          } else {
            cart.push({ id, title, price, qty: 1 });
          }
          localStorage.setItem('cart', JSON.stringify(cart));
          alert(title + ' added to cart!');
        });
      });
    `;
  } else if (matchedPage.template === 'cart') {
    pageContent = `
      <div class="container" style="max-width:800px;">
        <h2>Shopping Cart</h2>
        <div id="cart-items" style="margin-top:var(--spacing-lg); border: 1px solid rgba(0,0,0,0.05); border-radius:var(--rounded-md); padding:var(--spacing-md); background:white;">
          Loading cart...
        </div>
        <div style="margin-top:var(--spacing-md); display:flex; justify-content:space-between; align-items:center;">
          <h3 id="cart-total">Total: $0.00</h3>
          <a href="/checkout" class="btn">Proceed to Checkout</a>
        </div>
      </div>
    `;

    scriptWidget = `
      function renderCart() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const container = document.getElementById('cart-items');
        const totalContainer = document.getElementById('cart-total');
        if (cart.length === 0) {
          container.innerHTML = '<p>Your cart is empty.</p>';
          totalContainer.innerHTML = 'Total: $0.00';
          return;
        }
        let html = '';
        let total = 0;
        cart.forEach((item, idx) => {
          const subtotal = item.price * item.qty;
          total += subtotal;
          html += \`
            <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--spacing-sm) 0; border-bottom:\${idx < cart.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none'}">
              <div>
                <strong>\${item.title}</strong><br/>
                <span style="color:rgba(0,0,0,0.5); font-size:0.9rem;">$\${item.price.toFixed(2)} x \${item.qty}</span>
              </div>
              <div>
                <strong>$\${subtotal.toFixed(2)}</strong>
                <button onclick="removeFromCart('\${item.id}')" style="background:none; border:none; color:red; margin-left:16px; cursor:pointer;">Remove</button>
              </div>
            </div>\`;
        });
        container.innerHTML = html;
        totalContainer.innerHTML = 'Total: $' + total.toFixed(2);
      }
      window.removeFromCart = function(id) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart = cart.filter(x => x.id !== id);
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
      };
      renderCart();
    `;
  } else if (matchedPage.template === 'checkout') {
    pageContent = `
      <div class="container" style="max-width:600px;">
        <h2>Checkout</h2>
        <form id="checkout-form" style="margin-top:var(--spacing-lg); display:flex; flex-direction:column; gap:var(--spacing-md); background:white; padding:var(--spacing-md); border-radius:var(--rounded-md); border: 1px solid rgba(0,0,0,0.05);">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Name</label>
            <input type="text" id="cust-name" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Email</label>
            <input type="email" id="cust-email" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Delivery Address</label>
            <input type="text" id="cust-address" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <button type="submit" class="btn" style="width:100%; margin-top:12px;">Place Order</button>
        </form>
      </div>
    `;

    scriptWidget = `
      document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (cart.length === 0) {
          alert('Your cart is empty!');
          return;
        }
        
        const payload = {
          name: document.getElementById('cust-name').value,
          email: document.getElementById('cust-email').value,
          address: document.getElementById('cust-address').value,
          items: cart
        };

        try {
          const res = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.removeItem('cart');
            alert('Order placed successfully! Order ID: ' + data.orderId);
            window.location.href = '/';
          } else {
            alert('Failed to place order.');
          }
        } catch {
          alert('Network error.');
        }
      });
    `;
  } else if (matchedPage.template === 'booking-widget') {
    pageContent = `
      <div class="container" style="max-width:600px;">
        <h2>Book an Appointment</h2>
        <form id="booking-form" style="margin-top:var(--spacing-lg); display:flex; flex-direction:column; gap:var(--spacing-md); background:white; padding:var(--spacing-md); border-radius:var(--rounded-md); border: 1px solid rgba(0,0,0,0.05);">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Select Service</label>
            <select id="book-service" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);">
              <option value="Standard Service">Standard Consultation</option>
              <option value="Premium Service">Premium Consultation</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Date</label>
            <input type="date" id="book-date" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Time Slot</label>
            <select id="book-slot" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);">
              <option value="09:00 AM">09:00 AM</option>
              <option value="11:00 AM">11:00 AM</option>
              <option value="02:00 PM">02:00 PM</option>
              <option value="04:00 PM">04:00 PM</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Your Name</label>
            <input type="text" id="book-name" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <button type="submit" class="btn" style="width:100%; margin-top:12px;">Confirm Booking</button>
        </form>
      </div>
    `;

    scriptWidget = `
      document.getElementById('booking-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          service: document.getElementById('book-service').value,
          date: document.getElementById('book-date').value,
          slot: document.getElementById('book-slot').value,
          name: document.getElementById('book-name').value
        };

        try {
          const res = await fetch('/api/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const data = await res.json();
            alert('Booking confirmed successfully! Booking ID: ' + data.bookingId);
            window.location.href = '/';
          } else {
            alert('Failed to confirm booking.');
          }
        } catch {
          alert('Network error.');
        }
      });
    `;
  } else if (matchedPage.template === 'contact') {
    pageContent = `
      <div class="container" style="max-width:600px;">
        <h2>Contact Us</h2>
        <form id="contact-form" style="margin-top:var(--spacing-lg); display:flex; flex-direction:column; gap:var(--spacing-md); background:white; padding:var(--spacing-md); border-radius:var(--rounded-md); border: 1px solid rgba(0,0,0,0.05);">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Name</label>
            <input type="text" id="contact-name" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Email/Phone</label>
            <input type="text" id="contact-info" required style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15);"/>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:var(--spacing-xs);">Message</label>
            <textarea id="contact-msg" required rows="4" style="width:100%; padding:var(--spacing-sm); border-radius:var(--rounded-sm); border:1px solid rgba(0,0,0,0.15); font-family:inherit;"></textarea>
          </div>
          <button type="submit" class="btn" style="width:100%; margin-top:12px;">Send Message</button>
        </form>
      </div>
    `;

    scriptWidget = `
      document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('contact-name').value,
          info: document.getElementById('contact-info').value,
          message: document.getElementById('contact-msg').value
        };

        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            alert('Thank you for contacting us! We will get back to you shortly.');
            window.location.href = '/';
          } else {
            alert('Failed to send contact info.');
          }
        } catch {
          alert('Network error.');
        }
      });
    `;
  }

  // 8. Output full HTML response
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${designTokens.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  <header class="header">
    <a href="/" style="font-size:1.5rem; font-weight:700; color:var(--primary); text-decoration:none;">${designTokens.name}</a>
    <nav class="nav">
      ${navHtml}
      <a href="/cart" class="nav-link">CART (<span id="cart-count">0</span>)</a>
    </nav>
  </header>
  
  <main>${pageContent}</main>
  
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} ${designTokens.name}. Powered by tar.</p>
  </footer>

  <script>
    // Update cart counts
    function updateCartCount() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = cart.reduce((acc, x) => acc + x.qty, 0);
      const countEl = document.getElementById('cart-count');
      if (countEl) countEl.innerText = count;
    }
    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    
    // Page custom scripts
    ${scriptWidget}
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
