import { Hono } from 'hono';
import { renderStorefront } from './storefront/renderer';
import { editorShell } from './storefront/editor';
import { initClient } from './lib/db';
import { findActionMemories, incrementMemoryUsage } from './lib/memory';
import { getUserTimeline } from './lib/inbox';
import { executeRead, executeCreate, executeUpdate, executeDelete } from './lib/helpers';
import { handleChannelMessage, sendChannelMessage, getChannelConfig } from './channels';
import { listTemplates, getTemplate, installTemplate, searchTemplates } from './marketplace/templates';
import { getSkillsForVertical } from './lib/skills';
import { uploadDocument, getPresignedUrl, getDocument, listDocuments, deleteDocument } from './lib/s3';
import { uploadWorkspaceFile, readWorkspaceFile, readWorkspaceIndex, deleteWorkspaceFile, initWorkspaceFromVertical, uploadVerticalFile, readVerticalFile, listWorkspaceModules } from './lib/okf';
import { handleWebSocketUpgrade, pushMotionEvent } from './lib/websocket';
import { getOrCreateUserDb } from './lib/user-db';

function getDO(env: any, slug: string) {
  return env.EDITOR.get(env.EDITOR.idFromName(slug));
}

function storePendingPage(slug: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center"><h1 class="text-4xl font-bold text-gray-900 mb-4">${slug}</h1><p class="text-gray-500 mb-4">This workspace is being set up.</p></div></body></html>`;
}

const app = new Hono();

app.use('*', async (c, next) => {
  const url = c.env.TURSO_DATABASE_URL;
  const token = c.env.TURSO_AUTH_TOKEN;
  if (url) initClient(url, token);
  await next();
});



// ============================================================
// API Routes
// ============================================================

// GET /workspaces — list user's workspaces
app.get('/workspaces', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const result = await c.env.DB.prepare(
    'SELECT subdomain, scope, user_id, vertical FROM workspaces WHERE user_id = ?'
  ).bind(userId).all();
  const workspaces = (result.results || []).map((r: any) => ({
    scope: r.scope,
    subdomain: r.subdomain,
    vertical: r.vertical || 'restaurant',
    role: r.user_id === userId ? 'owner' : 'member',
  }));
  return c.json({ workspaces });
});

// POST /workspaces/create — create a new workspace
app.post('/workspaces/create', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();
  const { name, template, subdomain, vertical } = body || {};

  if (!name || !template || !subdomain) {
    return c.json({ error: 'Missing name, template, or subdomain' }, 400);
  }

  const scope = `w:${subdomain}`;
  const vert = vertical || template; // template = vertical type for now

  try {
    // 1. Insert workspace into D1 with vertical type
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO workspaces (subdomain, scope, user_id, vertical) VALUES (?, ?, ?, ?)'
    ).bind(subdomain, scope, userId, vert).run();

    // 2. Link user as owner via graph (optional — needs Turso)
    try {
      await executeCreate({
        table: 'graph',
        src: userId,
        rel: 'owner',
        tgt: scope,
      });
    } catch (graphErr) {
      console.warn('[workspaces] Graph link skipped (Turso not configured):', graphErr);
    }

    // 3. Copy vertical SKILL.md files to workspace S3
    let okfResult = 'skipped';
    try {
      await initWorkspaceFromVertical(c.env, scope, name, vert);
      okfResult = 'done';
    } catch (okfErr: any) {
      okfResult = `error: ${okfErr.message}`;
      console.warn('[workspaces] OKF init error:', okfErr);
    }

    // 4. Create WorkspaceDO instance (optional — needs DO binding)
    try {
      const doId = c.env.WORKSPACE.idFromName(scope);
      const stub = c.env.WORKSPACE.get(doId);
      await stub.fetch('https://internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, name, vertical: vert }),
      });
    } catch (doErr) {
      console.warn('[workspaces] DO warm-up skipped:', doErr);
    }

    return c.json({ scope, subdomain, name, vertical: vert, okf: okfResult });
  } catch (e: any) {
    console.error('[workspaces] Create failed:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================
// User Database Routes (per-user Turso DB for sync)
// ============================================================

// GET /user-db — get or create user's Turso DB credentials
app.get('/user-db', async (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  const platformToken = c.env.TURSO_PLATFORM_TOKEN;
  if (!platformToken) {
    // Return graceful error — sync not available yet
    return c.json({ error: 'Turso sync not configured', synced: false }, 200);
  }

  try {
    const { url, authToken } = await getOrCreateUserDb(c.env.DB, userId, platformToken);
    return c.json({ url, authToken });
  } catch (e: any) {
    console.error('[user-db] Error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================
// Marketplace Routes
// ============================================================

// GET /marketplace/templates — list all templates
app.get('/marketplace/templates', async (c) => {
  const q = c.req.query('q');
  const templates = q ? searchTemplates(q) : listTemplates();
  return c.json({ templates });
});

// GET /marketplace/templates/:id — get template details
app.get('/marketplace/templates/:id', async (c) => {
  const template = getTemplate(c.req.param('id'));
  if (!template) return c.json({ error: 'Template not found' }, 404);
  return c.json({ template });
});

// POST /marketplace/install — install template into workspace
app.post('/marketplace/install', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();
  if (!body?.templateId || !body?.scope) return c.json({ error: 'Missing templateId or scope' }, 400);
  try {
    const result = await installTemplate(body.templateId, body.scope, userId);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// ============================================================
// Tool Routes (6 generic tools)
// ============================================================

const TOOL_MAP: Record<string, Function> = {
  create: executeCreate,
  read: executeRead,
  update: executeUpdate,
  delete: executeDelete,
  link: executeCreate,
  search: executeRead,
};

// POST /tools/:name
app.post('/tools/:name', async (c) => {
  const name = c.req.param('name');
  const handler = TOOL_MAP[name];
  if (!handler) return c.json({ error: `Unknown tool: ${name}` }, 404);

  const body = await c.req.json();
  try {
    const result = await handler(body);
    return c.json(result);
  } catch (e: any) {
    // Return empty results if Turso not configured
    if (e.message?.includes('TURSO_DATABASE_URL')) {
      return c.json({ rows: [], count: 0 });
    }
    return c.json({ error: e.message }, 500);
  }
});


// ============================================================
// Document Routes (Railway S3)
// ============================================================

// POST /documents/upload — upload document
app.post('/documents/upload', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();
  if (!body?.scope || !body?.fileName || !body?.fileContent) {
    return c.json({ error: 'Missing scope, fileName, or fileContent' }, 400);
  }
  try {
    const buffer = Uint8Array.from(atob(body.fileContent), c => c.charCodeAt(0));
    const result = await uploadDocument(
      c.env, body.scope, body.category || 'general',
      body.fileName, buffer.buffer, body.mimeType || 'application/octet-stream',
      userId
    );
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// GET /documents/:id — get document metadata
app.get('/documents/:id', async (c) => {
  const doc = await getDocument(c.req.param('id'));
  if (!doc) return c.json({ error: 'Document not found' }, 404);
  return c.json({ document: doc });
});

// GET /documents/:id/download — get presigned download URL
app.get('/documents/:id/download', async (c) => {
  const doc = await getDocument(c.req.param('id'));
  if (!doc) return c.json({ error: 'Document not found' }, 404);
  const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  const url = await getPresignedUrl(c.env, data?.storage_key);
  return c.json({ url });
});

// GET /documents/list — list workspace documents
app.get('/documents/list', async (c) => {
  const scope = c.req.query('scope') || 'global';
  const category = c.req.query('category');
  const docs = await listDocuments(scope, category);
  return c.json({ documents: docs });
});

// DELETE /documents/:id — soft-delete document
app.delete('/documents/:id', async (c) => {
  await deleteDocument(c.req.param('id'));
  return c.json({ ok: true });
});

// ============================================================
// OKF Routes (Open Knowledge Format)
// ============================================================

// POST /okf/upload — upload OKF file
app.post('/okf/upload', async (c) => {
  const body = await c.req.json();
  if (!body?.scope || !body?.path || !body?.content) {
    return c.json({ error: 'Missing scope, path, or content' }, 400);
  }
  try {
    const result = await uploadWorkspaceFile(c.env, body.scope, body.path, body.content);
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /okf/edit — update OKF file
app.post('/okf/edit', async (c) => {
  const body = await c.req.json();
  if (!body?.scope || !body?.path || !body?.content) {
    return c.json({ error: 'Missing scope, path, or content' }, 400);
  }
  try {
    const result = await uploadWorkspaceFile(c.env, body.scope, body.path, body.content);
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// GET /okf/read — read OKF file
app.get('/okf/read', async (c) => {
  const scope = c.req.query('scope');
  const path = c.req.query('path');
  if (!scope || !path) return c.json({ error: 'Missing scope or path' }, 400);
  const content = await readWorkspaceFile(c.env, scope, path);
  if (content === null) return c.json({ error: 'File not found' }, 404);
  return c.json({ content });
});

// GET /okf/index — read root index.md
app.get('/okf/index', async (c) => {
  const scope = c.req.query('scope');
  if (!scope) return c.json({ error: 'Missing scope' }, 400);
  const content = await readWorkspaceIndex(c.env, scope);
  if (content === null) return c.json({ error: 'Index not found' }, 404);
  return c.json({ content });
});

// DELETE /okf/file — delete OKF file
app.delete('/okf/file', async (c) => {
  const scope = c.req.query('scope');
  const path = c.req.query('path');
  if (!scope || !path) return c.json({ error: 'Missing scope or path' }, 400);
  await deleteWorkspaceFile(c.env, scope, path);
  return c.json({ ok: true });
});

// ============================================================
// Verticals Routes (global templates on S3)
// ============================================================

// POST /verticals/upload — upload vertical template file
app.post('/verticals/upload', async (c) => {
  const body = await c.req.json();
  const { vertical, path, content } = body || {};
  if (!vertical || !path || !content) return c.json({ error: 'Missing vertical, path, or content' }, 400);
  const result = await uploadVerticalFile(c.env, vertical, path, content);
  return c.json({ ok: true, ...result });
});

// GET /verticals/read — read vertical template file
app.get('/verticals/read', async (c) => {
  const vertical = c.req.query('vertical');
  const path = c.req.query('path');
  if (!vertical || !path) return c.json({ error: 'Missing vertical or path' }, 400);
  const content = await readVerticalFile(c.env, vertical, path);
  if (content === null) return c.json({ error: 'File not found' }, 404);
  return c.json({ content });
});

// GET /memory/autocomplete — find matching action memories
app.get('/memory/autocomplete', async (c) => {
  const q = c.req.query('q') || '';
  const userId = c.req.header('X-User-Id') || 'guest';
  if (!q.trim()) return c.json({ memories: [] });
  const memories = await findActionMemories(userId, q, 5);
  return c.json({ memories });
});

// POST /memory/replay — increment usage count on replay
app.post('/memory/replay', async (c) => {
  const body = await c.req.json();
  if (!body?.memoryId) return c.text('Missing memoryId', 400);
  await incrementMemoryUsage(body.memoryId);
  return c.json({ ok: true });
});

// GET /timeline — user's personal timeline
app.get('/timeline', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const limit = parseInt(c.req.query('limit') || '50');
  const since = c.req.query('since');
  try {
    const result = await getUserTimeline(userId, { limit, since });
    return c.json({ motions: result.rows });
  } catch (e: any) {
    return c.json({ motions: [] });
  }
});

// ============================================================
// Agent Routes
// ============================================================

const BASE_SYSTEM_PROMPT = `You are a business assistant for tarai. You help users manage their workspaces.

AVAILABLE TOOLS (use these exact names):
- create: create a new record. Params: table, type, title, value, qty, data, scope
- read: query records. Params: table, type, scope, id
- update: modify a record. Params: table, id, data
- delete: remove a record. Params: table, id
- link: create a relationship. Params: src, rel, tgt

RULES:
1. When user wants to DO something, respond with ONLY this JSON (no other text):
{"action":"tool_call","tool":"create","table":"matter","type":"TYPE","title":"NAME","value":PRICE,"qty":QUANTITY,"data":{}}

2. The "tool" field MUST be one of: create, read, update, delete, link. NOT action names like create_order.

3. For questions, respond with plain text. For greetings, plain text.

4. Be concise. One sentence answers when possible.`;

// POST /agents/master/:sessionId — chat with agent
app.post('/agents/master/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();
  const message = body?.message || '';
  const scope = body?.scope || '';

  if (!message.trim()) {
    return c.json({ reply: 'Please send a message.' });
  }

  // Look up workspace to get vertical and scope
  let vertical = 'restaurant';
  let workspaceScope = scope;
  if (workspaceScope) {
    const ws = await c.env.DB.prepare(
      'SELECT scope, vertical FROM workspaces WHERE scope = ?'
    ).bind(workspaceScope).first();
    if (ws) vertical = ws.vertical || 'restaurant';
  } else {
    const ws = await c.env.DB.prepare(
      'SELECT scope, vertical FROM workspaces WHERE user_id = ? LIMIT 1'
    ).bind(userId).first();
    if (ws) {
      workspaceScope = ws.scope;
      vertical = ws.vertical || 'restaurant';
    }
  }

  // Load SKILL.md from workspace's S3 files (not hardcoded)
  let skillsContent = '';
  if (workspaceScope) {
    const modules = await listWorkspaceModules(c.env, workspaceScope);
    const skillParts: string[] = [];
    for (const mod of modules) {
      const content = await readWorkspaceFile(c.env, workspaceScope, `${mod}.md`);
      if (content) skillParts.push(content);
    }
    skillsContent = skillParts.join('\n\n');
  }
  // Fallback to hardcoded if S3 has nothing
  if (!skillsContent) skillsContent = getSkillsForVertical(vertical);
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## Installed Skills\n${skillsContent}`;

  const groqKey = c.env.GROQ_API_KEY;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data = await res.json() as any;
    const reply = data?.choices?.[0]?.message?.content || 'Sorry, I could not process that.';

    // Try to parse as tool call — strip code blocks if present
    let toolCall = null;
    try {
      let cleanReply = reply.trim();
      // Strip markdown code blocks
      cleanReply = cleanReply.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      // Try direct JSON parse first
      const parsed = JSON.parse(cleanReply);
      if (parsed.action === 'tool_call' && parsed.tool) {
        toolCall = parsed;
      }
    } catch {
      // Try to extract JSON from text
      try {
        const jsonMatch = reply.match(/\{[\s\S]*"action"\s*:\s*"tool_call"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action === 'tool_call' && parsed.tool) {
            toolCall = parsed;
          }
        }
      } catch {}
    }

    // Execute tool call if present
    let toolResult = null;
    if (toolCall) {
      const handler = TOOL_MAP[toolCall.tool];
      if (handler) {
        try {
          toolResult = await handler({ ...toolCall.params, scope: toolCall.params.scope || 'global' });
        } catch (e: any) {
          toolResult = { error: e.message };
        }
      }
    }

    // Build friendly reply
    let finalReply = reply;
    if (toolCall) {
      if (toolCall.tool === 'create' && toolCall.table === 'matter') {
        finalReply = `Created ${toolCall.type || 'item'}: ${toolCall.title || 'done'}`;
      } else if (toolCall.tool === 'read') {
        finalReply = toolResult?.rows?.length
          ? `Found ${toolResult.rows.length} items`
          : 'No items found';
      } else if (toolCall.tool === 'update') {
        finalReply = 'Updated successfully';
      } else {
        finalReply = 'Done';
      }
    }

    return c.json({
      reply: finalReply,
      sessionId,
      toolCall,
      toolResult,
    });
  } catch (e: any) {
    console.error('[Agent] Error:', e.message);
    return c.json({ reply: 'Something went wrong. Please try again.', error: e.message });
  }
});

// ============================================================
// Channel Webhook Routes
// ============================================================

// POST /channels/telegram/webhook
app.post('/channels/telegram/webhook', async (c) => {
  const body = await c.req.json();
  const message = await handleChannelMessage('telegram', body, { DB: c.env.DB });
  if (!message) return c.json({ ok: true });

  // Look up scope from D1
  let scope = 'global';
  if (c.env.DB) {
    const row = await c.env.DB.prepare(
      'SELECT scope FROM channels WHERE chat_id = ?'
    ).bind(message.chatId).first();
    if (row?.scope) scope = row.scope;
  }

  // Process message through agent (placeholder — would call agent here)
  const reply = `Received: ${message.content}`;

  // Send response
  const config = await getChannelConfig('telegram', scope);
  if (config) {
    await sendChannelMessage('telegram', config, {
      chatId: message.chatId,
      text: reply,
      replyToMessageId: message.messageId,
    });
  }

  return c.json({ ok: true });
});

// POST /channels/slack/events
app.post('/channels/slack/events', async (c) => {
  const body = await c.req.json();

  // Slack URL verification
  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge });
  }

  const message = await handleChannelMessage('slack', body, { DB: c.env.DB });
  if (!message) return c.json({ ok: true });

  let scope = 'global';
  if (c.env.DB) {
    const row = await c.env.DB.prepare(
      'SELECT scope FROM channels WHERE chat_id = ?'
    ).bind(message.chatId).first();
    if (row?.scope) scope = row.scope;
  }

  const reply = `Received: ${message.content}`;
  const config = await getChannelConfig('slack', scope);
  if (config) {
    await sendChannelMessage('slack', config, {
      chatId: message.chatId,
      text: reply,
    });
  }

  return c.json({ ok: true });
});

// POST /channels/discord/webhook
app.post('/channels/discord/webhook', async (c) => {
  const body = await c.req.json();
  const message = await handleChannelMessage('discord', body, { DB: c.env.DB });
  if (!message) return c.json({ ok: true });

  let scope = 'global';
  if (c.env.DB) {
    const row = await c.env.DB.prepare(
      'SELECT scope FROM channels WHERE chat_id = ?'
    ).bind(message.chatId).first();
    if (row?.scope) scope = row.scope;
  }

  const reply = `Received: ${message.content}`;
  const config = await getChannelConfig('discord', scope);
  if (config) {
    await sendChannelMessage('discord', config, {
      chatId: message.chatId,
      text: reply,
    });
  }

  return c.json({ ok: true });
});

// ============================================================
// WebSocket Route (real-time updates)
// ============================================================

app.get('/ws', (c) => {
  const userId = c.req.query('userId') || c.req.header('X-User-Id') || 'guest';
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }
  return handleWebSocketUpgrade(c.req.raw, userId);
});

// Workspace site routes (only for *.tarai.space)
app.notFound(async (c) => {
  const url = new URL(c.req.url);
  const host = url.hostname;
  const workspaceMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
  if (!workspaceMatch) return c.text('Not found', 404);
  const workspaceSlug = workspaceMatch[1];

  // Look up workspace from KV cache or D1
  let scope = await c.env.STOREFRONT_CACHE.get(`scope:${workspaceSlug}`);
  if (!scope && c.env.DB) {
    const row = await c.env.DB.prepare(
      "SELECT scope FROM workspaces WHERE subdomain = ?"
    ).bind(workspaceSlug).first();
    scope = row?.scope;
    if (scope) {
      await c.env.STOREFRONT_CACHE.put(`scope:${workspaceSlug}`, scope, { expirationTtl: 300 });
    }
  }

  if (!scope) return c.html(storePendingPage(workspaceSlug));

  // GET routes
  if (c.req.method === 'GET') {
    if (url.pathname === '/edit/ws') {
      if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket', 426);
      return getDO(c.env, workspaceSlug).fetch('https://do/ws', c.req.raw);
    }
    if (url.pathname === '/edit') return c.html(editorShell(workspaceSlug));
    if (url.pathname === '/sitemap.xml') {
      return c.text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${workspaceSlug}.tarai.space/</loc></url></urlset>`, 200, { 'Content-Type': 'application/xml' });
    }

    const cached = await c.env.STOREFRONT_CACHE.get(`html:${workspaceSlug}`);
    if (cached) return c.html(cached);

    const layoutJson = await c.env.STOREFRONT_CACHE.get(`layout:${workspaceSlug}`, 'json');
    if (!layoutJson) return c.html(storePendingPage(workspaceSlug));

    const html = await renderStorefront(layoutJson, workspaceSlug);
    if (c.env.STOREFRONT_CACHE) {
      c.env.STOREFRONT_CACHE.put(`html:${workspaceSlug}`, html, { expirationTtl: 300 });
    }
    return c.html(html);
  }

  // POST routes
  if (c.req.method === 'POST') {
    if (url.pathname === '/draft') {
      const body = await c.req.json();
      if (!body?.subdomain || !body?.layout) return c.text('Missing subdomain or layout', 400);
      const html = await renderStorefront(body.layout, body.subdomain);
      await getDO(c.env, body.subdomain).fetch('https://do/push', { method: 'POST', body: html });
      return c.json({ ok: true });
    }
    if (url.pathname === '/publish') {
      const body = await c.req.json();
      if (!body?.subdomain || !body?.layout) return c.text('Missing subdomain or layout', 400);
      await c.env.STOREFRONT_CACHE.put(`layout:${body.subdomain}`, JSON.stringify(body.layout));
      await c.env.STOREFRONT_CACHE.delete(`html:${body.subdomain}`);
      return c.json({ ok: true });
    }
    if (url.pathname === '/api/checkout') {
      const body = await c.req.json();
      if (!body?.items) return c.text('Missing items', 400);
      const orderId = c.env.ORDER.newUniqueId();
      const orderDO = c.env.ORDER.get(orderId);
      return orderDO.fetch('https://do/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeSlug: workspaceSlug, items: body.items, email: body.email }) });
    }
    if (url.pathname === '/api/chat') {
      const body = await c.req.json();
      if (!body?.message) return c.text('Missing message', 400);
      const query = body.message.trim().toLowerCase();
      const l1Dict: Record<string, string> = { 'hi': 'Hello!', 'hello': 'Hi there!', 'hours': 'Open 24/7!' };
      if (l1Dict[query]) return c.json({ reply: l1Dict[query], layer: 'L1' });
      const cachedAnswer = await c.env.STOREFRONT_CACHE.get(`sem_cache:${query}`);
      if (cachedAnswer) return c.json({ reply: cachedAnswer, layer: 'L2' });
      return c.json({ reply: `Hello! How can I help you at ${workspaceSlug}?`, layer: 'L3' });
    }
  }

  return c.text('Not found', 404);
});

export default app;
