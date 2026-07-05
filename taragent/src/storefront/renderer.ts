/**
 * Storefront renderer for CF Worker.
 * Combines template + sections + theme → complete HTML page.
 */

import type { StorefrontLayout, StorefrontProduct } from './schema';
import { SECTION_RENDERERS } from './sections';

const TEMPLATES: Record<string, string> = {
  'streetwear-dark': `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`,

  'luxury-black': `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}
h1,h2,h3{font-family:var(--fontHeading),serif}</style>
</head><body><!-- SECTIONS --></body></html>`,

  'minimal-white': `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}
a{color:inherit;text-decoration:none}</style>
</head><body><!-- SECTIONS --></body></html>`,

  'modern-gradient': `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`,

  'editorial': `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{name}}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>:root{--primary:{{primary}};--bg:{{background}};--text:{{text}};--font:{{font}};--fontHeading:{{fontHeading}}}
body{font-family:var(--font),sans-serif;background:var(--bg);color:var(--text);margin:0}*{box-sizing:border-box}</style>
</head><body><!-- SECTIONS --></body></html>`,
};

function renderSections(
  sections: StorefrontLayout['sections'],
  products?: StorefrontProduct[]
): string {
  return sections
    .map((section) => {
      const renderer = SECTION_RENDERERS[section.type];
      if (!renderer) return `<!-- unknown section: ${section.type} -->`;
      return renderer(section.config || {}, products);
    })
    .join('\n');
}

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export async function renderStorefront(
  layout: StorefrontLayout,
  storeName: string,
  products?: StorefrontProduct[]
): Promise<string> {
  const template = TEMPLATES[layout.template] || TEMPLATES['streetwear-dark'];

  const sectionsHtml = renderSections(layout.sections, products);

  let html = template.replace('<!-- SECTIONS -->', sectionsHtml);

  // 1. Inject SEO tags & JSON-LD schema into head
  const seoHtml = `
  <meta name="description" content="Shop at ${storeName} for premium merchandise and apparel.">
  <meta property="og:title" content="${storeName}">
  <meta property="og:description" content="Shop at ${storeName} for premium merchandise and apparel.">
  <meta property="og:type" content="website">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "name": "${storeName}",
    "description": "Premium apparel and products storefront."
  }
  </script>
  </head>`;
  html = html.replace('</head>', seoHtml);

  // 2. Inject Cart Drawer, Chatbot UI, and Client JS before body close
  const widgetsHtml = `
<style>
  #cart-btn, #chat-btn {
    position: fixed; bottom: 20px; z-index: 50;
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15); cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  #cart-btn { left: 20px; background: var(--primary); color: #fff; }
  #chat-btn { right: 20px; background: #141416; color: #fff; border: 1px solid #2d2d30; }
  #cart-btn:hover, #chat-btn:hover { transform: scale(1.1) translateY(-2px); }
  
  .side-panel {
    position: fixed; top: 0; bottom: 0; width: 100%; max-width: 400px;
    background: var(--bg); border-left: 1px solid rgba(0,0,0,0.15);
    box-shadow: -10px 0 30px rgba(0,0,0,0.15); z-index: 100;
    transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; flex-direction: column; color: var(--text);
  }
  .side-panel.open { transform: translateX(0); }
  #cart-panel { right: 0; }
  #chat-panel { right: 0; }
  
  .backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
    z-index: 90; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
  }
  .backdrop.show { opacity: 1; pointer-events: auto; }
</style>

<!-- Floating Buttons -->
<div id="cart-btn" onclick="toggleCart(true)">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
  <span id="cart-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
</div>

<div id="chat-btn" onclick="toggleChat(true)">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-1.074-.83l1.012-3.791C4.03 14.885 3 12.631 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
  </svg>
</div>

<div id="backdrop" class="backdrop" onclick="closeAllPanels()"></div>

<!-- Cart Drawer -->
<div id="cart-panel" class="side-panel">
  <div class="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
    <h3 class="font-bold text-lg uppercase tracking-wider">Your Bag</h3>
    <button onclick="toggleCart(false)" class="text-sm opacity-50 hover:opacity-100">&times; Close</button>
  </div>
  <div id="cart-items" class="flex-1 overflow-y-auto p-6 space-y-4"></div>
  <div class="p-6 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-4">
    <div class="flex justify-between font-bold">
      <span>Subtotal</span>
      <span id="cart-subtotal">₹0.00</span>
    </div>
    <div id="checkout-form" class="hidden space-y-3">
      <input type="email" id="checkout-email" placeholder="Enter your email" class="w-full px-4 py-2 border bg-transparent text-sm rounded outline-none" required />
      <button onclick="processCheckout()" id="pay-btn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded text-sm uppercase tracking-wider transition">Confirm & Pay</button>
    </div>
    <button id="checkout-btn" onclick="showCheckoutForm()" class="w-full bg-primary text-white font-bold py-3 px-4 rounded text-sm uppercase tracking-wider hover:opacity-90 transition">Proceed to Checkout</button>
  </div>
</div>

<!-- Chat Panel -->
<div id="chat-panel" class="side-panel">
  <div class="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
    <h3 class="font-bold text-lg uppercase tracking-wider">Sales Assistant</h3>
    <button onclick="toggleChat(false)" class="text-sm opacity-50 hover:opacity-100">&times; Close</button>
  </div>
  <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-3 text-sm flex flex-col">
    <div class="bg-black/5 dark:bg-white/5 p-3 rounded-lg max-w-[85%] self-start">
      Hello! Ask me anything about our products, sizes, or stock availability.
    </div>
  </div>
  <form id="chat-form" onsubmit="sendChatMessage(event)" class="p-4 border-t border-black/10 dark:border-white/10 flex gap-2">
    <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 px-4 py-2 border rounded bg-transparent text-sm outline-none" />
    <button type="submit" class="bg-primary text-white px-4 py-2 rounded text-sm hover:opacity-90">Send</button>
  </form>
</div>

<script>
  let cart = JSON.parse(localStorage.getItem('cart') || '[]');

  function updateCartUI() {
    localStorage.setItem('cart', JSON.stringify(cart));
    const countEl = document.getElementById('cart-count');
    const itemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    countEl.textContent = totalQty;
    if (totalQty > 0) countEl.classList.remove('hidden');
    else countEl.classList.add('hidden');
    
    if (cart.length === 0) {
      itemsEl.innerHTML = '<div class="text-center opacity-40 py-12 text-sm">Your cart is empty.</div>';
      document.getElementById('checkout-btn').style.display = 'none';
      document.getElementById('checkout-form').classList.add('hidden');
    } else {
      document.getElementById('checkout-btn').style.display = 'block';
      itemsEl.innerHTML = cart.map((item, idx) => \`
        <div class="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
          <div>
            <h4 class="font-medium text-sm">\${item.name}</h4>
            <p class="text-xs opacity-60">₹\${item.price} x \${item.qty}</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="changeQty(\${idx}, -1)" class="w-6 h-6 rounded border flex items-center justify-center text-sm">-</button>
            <span class="text-xs font-semibold">\${item.qty}</span>
            <button onclick="changeQty(\${idx}, 1)" class="w-6 h-6 rounded border flex items-center justify-center text-sm">+</button>
          </div>
        </div>
      \`).join('');
    }
    
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    subtotalEl.textContent = '₹' + subtotal.toFixed(2);
  }

  function changeQty(idx, delta) {
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUI();
  }

  function toggleCart(show) {
    document.getElementById('cart-panel').classList.toggle('open', show);
    document.getElementById('backdrop').classList.toggle('show', show);
  }
  
  function toggleChat(show) {
    document.getElementById('chat-panel').classList.toggle('open', show);
    document.getElementById('backdrop').classList.toggle('show', show);
  }

  function closeAllPanels() {
    toggleCart(false);
    toggleChat(false);
  }

  function showCheckoutForm() {
    document.getElementById('checkout-btn').style.display = 'none';
    document.getElementById('checkout-form').classList.remove('hidden');
  }

  async function processCheckout() {
    const email = document.getElementById('checkout-email').value;
    if (!email) return alert('Please enter your email.');
    
    const payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';
    
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, items: cart }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Checkout failed');
        payBtn.disabled = false;
        payBtn.textContent = 'Confirm & Pay';
        return;
      }
      
      alert('Stock reserved successfully! Simulating Payment Gateway...');
      
      const payRes = await fetch('/api/webhook/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.id, success: true }),
      });
      
      if (payRes.ok) {
        alert('Order Placed Successfully! Your transaction is complete.');
        cart = [];
        updateCartUI();
        closeAllPanels();
      } else {
        alert('Payment verification failed.');
      }
    } catch(err) {
      alert('Error during checkout: ' + err.message);
    } finally {
      payBtn.disabled = false;
      payBtn.textContent = 'Confirm & Pay';
    }
  }

  async function sendChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    input.value = '';
    const messagesEl = document.getElementById('chat-messages');
    
    messagesEl.innerHTML += \`
      <div class="bg-indigo-600 text-white p-3 rounded-lg max-w-[85%] self-end mb-2">
        \${msg}
      </div>
    \`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      
      messagesEl.innerHTML += \`
        <div class="bg-black/5 dark:bg-white/5 p-3 rounded-lg max-w-[85%] self-start mb-2">
          \${data.reply || 'Sorry, I encountered an error.'}
        </div>
      \`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch(err) {
      messagesEl.innerHTML += \`
        <div class="bg-red-50 text-red-500 p-3 rounded-lg max-w-[85%] self-start mb-2">
          Could not reach AI server.
        </div>
      \`;
    }
  }

  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('add-to-cart-btn')) {
      const name = e.target.getAttribute('data-name');
      const price = parseFloat(e.target.getAttribute('data-price') || '0');
      
      // Look for variants/modifiers in parent product card container
      const card = e.target.closest('[data-product-id]');
      let finalName = name;
      if (card) {
        const variantSelect = card.querySelector('.variant-select');
        const modifierSelect = card.querySelector('.modifier-select');
        const variant = variantSelect ? variantSelect.value : '';
        const modifier = modifierSelect ? modifierSelect.value : '';
        
        let additions = [];
        if (variant) additions.push(variant);
        if (modifier) additions.push(modifier);
        if (additions.length) {
          finalName = name + ' (' + additions.join(', ') + ')';
        }
      }
      
      const existing = cart.find(item => item.name === finalName);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ name: finalName, price, qty: 1 });
      }
      updateCartUI();
      toggleCart(true);
    }
  });

  updateCartUI();
</script>
</body>`;
  html = html.replace('</body>', widgetsHtml);

  html = replaceVars(html, {
    name: storeName,
    primary: layout.theme.primary,
    background: layout.theme.background,
    text: layout.theme.text,
    font: layout.theme.font,
    fontHeading: layout.theme.fontHeading,
  });

  return html;
}
