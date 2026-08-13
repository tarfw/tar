import { Hono } from 'hono';
import { initClient } from './lib/db';
import { findActionMemories, incrementMemoryUsage } from './lib/memory';
import { getUserTimeline } from './lib/inbox';
import { executeRead, executeCreate, executeUpdate, executeDelete } from './lib/helpers';
import { handleChannelMessage, sendChannelMessage, getChannelConfig } from './channels';
import { uploadDocument, getPresignedUrl, getDocument, listDocuments, deleteDocument } from './lib/s3';
import { uploadWorkspaceFile, readWorkspaceFile, readWorkspaceIndex, deleteWorkspaceFile, initWorkspace, listWorkspaceModules, readWithFallback, scaffoldOkfFolders, generateOkfContent, addCanvasBlock, removeCanvasBlock } from './lib/okf';
import { CORE_MODULES } from './lib/core-modules';
import { extractBusinessInfo } from './lib/extract-business';
import { writeEvent, getUserInbox, markTaskDone } from './lib/events';
import { getOrCreateWorkspaceDb } from './lib/workspace-db';
import { dbContext, envContext } from './lib/db';
import { parseSkillMarkdown, generateCompactActionIndex } from './lib/skill-parser';
import { executeAITask } from './lib/action-executor';

function storePendingPage(slug: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${slug}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center"><h1 class="text-4xl font-bold text-gray-900 mb-4">${slug}</h1><p class="text-gray-500 mb-4">This workspace is being set up.</p></div></body></html>`;
}

const app = new Hono();

app.use('*', async (c, next) => {
  const url = c.env.TURSO_DATABASE_URL;
  const token = c.env.TURSO_AUTH_TOKEN;
  if (url) initClient(url, token);
  return envContext.run(c.env, next);
});

// ============================================================
// API Routes
// ============================================================

// GET /workspaces — list user's workspaces
app.get('/workspaces', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';

  // Ensure columns exist
  for (const col of ['user_id', 'type', 'custom_domain']) {
    try { await c.env.DB.prepare(`ALTER TABLE workspaces ADD COLUMN ${col} TEXT`).run(); } catch {}
  }

  const result = await c.env.DB.prepare(
    'SELECT subdomain, scope, user_id, type FROM workspaces WHERE user_id = ?'
  ).bind(userId).all();
  const workspaces = (result.results || []).map((r: any) => ({
    scope: r.scope,
    subdomain: r.subdomain,
    type: r.type || 'business',
    role: r.user_id === userId ? 'owner' : 'member',
  }));
  return c.json({ workspaces });
});

// POST /workspaces/create — create a new workspace
app.post('/workspaces/create', async (c) => {
  const userId = c.req.header('X-User-Id') || 'guest';
  const body = await c.req.json();
  const { name, subdomain, description, modules, message } = body || {};

  if (!message && (!name || !subdomain)) {
    return c.json({ error: 'Missing name/subdomain or message' }, 400);
  }

  // AI extracts business info from message if provided (one-message creation)
  let businessData: any = null;
  if (message) {
    try {
      businessData = await extractBusinessInfo(message, c.env);
    } catch (err) {
      console.warn('[workspaces] Business extraction failed:', err);
    }
  }

  // Use extracted data or provided fields
  const wsName = businessData?.name || name || 'My Workspace';
  const wsDescription = businessData?.description || description || '';

  // Generate subdomain from business name if message was provided
  let wsSubdomain = message && businessData?.name
    ? businessData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    : subdomain;

  if (!wsSubdomain) {
    wsSubdomain = `ws-${Math.random().toString(36).substring(2, 8)}`;
  }

  const scope = `w:${wsSubdomain}`;

  // AI generates workspace type from description or business name
  const combinedText = `${wsName} ${wsDescription}`.toLowerCase();
  
  const workspaceType = businessData?.type
    || (combinedText.includes('restaurant') || combinedText.includes('cafe') || combinedText.includes('pizza') || combinedText.includes('food') || combinedText.includes('bakery') ? 'restaurant'
    : combinedText.includes('salon') || combinedText.includes('beauty') || combinedText.includes('spa') || combinedText.includes('barber') ? 'salon'
    : combinedText.includes('clinic') || combinedText.includes('doctor') || combinedText.includes('health') || combinedText.includes('dental') ? 'clinic'
    : combinedText.includes('gym') || combinedText.includes('fitness') ? 'gym'
    : combinedText.includes('taxi') || combinedText.includes('cab') || combinedText.includes('delivery') || combinedText.includes('logistics') ? 'logistics'
    : combinedText.includes('grocery') || combinedText.includes('mart') || combinedText.includes('supermarket') ? 'grocery'
    : combinedText.includes('retail') || combinedText.includes('store') || combinedText.includes('shop') || combinedText.includes('clothing') ? 'retail'
    : 'business');

  // AI picks core skills based on business matrix if modules are not provided
  let defaultModsForType = ['orders', 'inventory', 'crm', 'reports'];
  if (workspaceType === 'restaurant') {
    defaultModsForType = ['orders', 'inventory', 'bookings', 'hr'];
  } else if (workspaceType === 'salon') {
    defaultModsForType = ['bookings', 'inventory', 'crm'];
  } else if (workspaceType === 'clinic') {
    defaultModsForType = ['bookings', 'crm', 'hr', 'documents'];
  } else if (workspaceType === 'logistics') {
    defaultModsForType = ['logistics', 'orders', 'crm', 'expenses'];
  } else if (workspaceType === 'grocery') {
    defaultModsForType = ['orders', 'inventory', 'logistics'];
  }

  const mods = (modules && Array.isArray(modules) && modules.length > 0) ? modules : defaultModsForType;

  try {
    // Check if subdomain is already taken
    const existing = await c.env.DB.prepare(
      'SELECT 1 FROM workspaces WHERE subdomain = ?'
    ).bind(wsSubdomain).first();

    if (existing) {
      return c.json({ error: 'This subdomain URL is already taken. Please choose another name.' }, 400);
    }

    // 1. Insert workspace into D1 with type
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO workspaces (subdomain, scope, user_id, type, name) VALUES (?, ?, ?, ?, ?)'
    ).bind(wsSubdomain, scope, userId, workspaceType, wsName).run();

    // 2. Initialize Turso DB for workspace
    let dbResult = 'skipped';
    if (c.env.TURSO_PLATFORM_TOKEN) {
      try {
        const { url } = await getOrCreateWorkspaceDb(c.env.DB, wsSubdomain, scope, c.env.TURSO_PLATFORM_TOKEN);
        dbResult = `created: ${url}`;
      } catch (dbErr: any) {
        dbResult = `error: ${dbErr.message}`;
        console.warn('[workspaces] Turso DB creation failed:', dbErr);
      }
    }

    // 3. Link user as owner via graph
    try {
      if (c.env.TURSO_PLATFORM_TOKEN) {
        const wsCreds = await getOrCreateWorkspaceDb(c.env.DB, wsSubdomain, scope, c.env.TURSO_PLATFORM_TOKEN);
        await dbContext.run({ url: wsCreds.url, token: wsCreds.authToken }, async () => {
          await executeCreate({
            table: 'graph',
            src: userId,
            rel: 'owner',
            tgt: scope,
          });
        });
      } else {
        await executeCreate({
          table: 'graph',
          src: userId,
          rel: 'owner',
          tgt: scope,
        });
      }
    } catch (graphErr) {
      console.warn('[workspaces] Graph link skipped:', graphErr);
    }

    // 4. Scaffold OKF folder structure + generate content
    let okfResult = 'skipped';
    try {
      await scaffoldOkfFolders(c.env, scope, wsName, mods);

      if (businessData) {
        await generateOkfContent(c.env, scope, businessData, mods, userId);
      }

      await initWorkspace(c.env, scope, wsName, mods, wsDescription);
      okfResult = 'done';
    } catch (okfErr: any) {
      okfResult = `error: ${okfErr.message}`;
      console.warn('[workspaces] OKF init error:', okfErr);
    }

    return c.json({
      scope,
      subdomain: wsSubdomain,
      name: wsName,
      business: businessData,
      okf: okfResult,
      db: dbResult,
    });
  } catch (e: any) {
    console.error('[workspaces] Create failed:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================
// User Database Routes (per-user Turso DB for sync)
// ============================================================

// GET /workspace-db — get or create workspace's Turso DB credentials
app.get('/workspace-db', async (c) => {
  const subdomain = c.req.query('subdomain') || c.req.header('X-Subdomain') || '';
  if (!subdomain) return c.json({ error: 'Missing subdomain' }, 400);

  const scope = `w:${subdomain}`;
  const platformToken = c.env.TURSO_PLATFORM_TOKEN;
  if (!platformToken) {
    return c.json({ error: 'Turso workspace database not configured', synced: false }, 200);
  }

  try {
    const { url, authToken } = await getOrCreateWorkspaceDb(c.env.DB, subdomain, scope, platformToken);
    return c.json({ url, authToken });
  } catch (e: any) {
    console.error('[workspace-db] Error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================
// Marketplace Routes
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

// POST /tools/execute — read .md from S3, parse, run steps against Turso
app.post('/tools/execute', async (c) => {
  const body = await c.req.json();
  const { action, params, scope } = body;
  if (!action || !scope) {
    return c.json({ error: 'Missing action or scope' }, 400);
  }

  try {
    const result = await executeAITask(c.env, action, params || {}, scope);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /tools/:name
app.post('/tools/:name', async (c) => {
  const name = c.req.param('name');
  const handler = TOOL_MAP[name];
  if (!handler) return c.json({ error: `Unknown tool: ${name}` }, 404);

  const body = await c.req.json();
  const scope = body.scope || body.stream || body.src || body.tgt || '';

  let dbUrl = '';
  let dbToken = '';

  if (c.env.DB && scope) {
    const subdomain = scope.startsWith('w:')
      ? scope.replace('w:', '')
      : scope.startsWith('o:')
      ? scope.replace('o:', '').split('_')[0]
      : scope;

    try {
      const ws = await c.env.DB.prepare(
        'SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(subdomain).first();

      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (c.env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(c.env.DB, subdomain, `w:${subdomain}`, c.env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    } catch (err) {
      console.warn('[tools] Failed to resolve Turso workspace DB credentials:', err);
    }
  }

  const executeFn = async () => {
    return handler(body);
  };

  try {
    let result;
    if (dbUrl) {
      result = await dbContext.run({ url: dbUrl, token: dbToken }, executeFn);
    } else {
      result = await executeFn();
    }
    return c.json(result);
  } catch (e: any) {
    if (e.message?.includes('TURSO_DATABASE_URL')) {
      if (name === 'read' || name === 'search') {
        return c.json({ rows: [], count: 0 });
      }
      return c.json({ error: 'TURSO_DATABASE_URL not configured' }, 400);
    }
    return c.json({ error: e.message }, 500);
  }
});

// GET /ai-tasks — list parsed tasks/actions for workspace
app.get('/ai-tasks', async (c) => {
  const scope = c.req.query('scope');
  if (!scope) {
    return c.json({ error: 'Missing scope' }, 400);
  }

  const cacheKey = `ai-tasks:${scope}`;
  if (c.env.STOREFRONT_CACHE) {
    try {
      const cached = await c.env.STOREFRONT_CACHE.get(cacheKey);
      if (cached) {
        return c.json(JSON.parse(cached));
      }
    } catch (err) {
      console.warn('[ai-tasks] Cache read failed:', err);
    }
  }

  try {
    let modules = await listWorkspaceModules(c.env, scope);

    // If no modules in workspace, use core modules as fallback
    if (modules.length === 0) {
      modules = Object.keys(CORE_MODULES);
    }

    const actions: any[] = [];
    for (const mod of modules) {
      const content = await readWithFallback(c.env, scope, `skills/${mod}.md`);

      if (content) {
        const parsed = parseSkillMarkdown(content);
        for (const action of parsed.actions) {
          actions.push({
            name: action.name,
            module: mod,
            purpose: action.purpose,
            intents: action.intents,
            params: action.params,
            steps: action.steps.length,
            tool: action.steps[0]?.tool || 'custom',
            table: action.steps[0]?.table || '',
            type: action.steps[0]?.type || '',
          });
        }
      }
    }

    const responseData = { actions };

    if (c.env.STOREFRONT_CACHE) {
      try {
        await c.env.STOREFRONT_CACHE.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 300 });
      } catch (err) {
        console.warn('[ai-tasks] Cache write failed:', err);
      }
    }

    return c.json(responseData);
  } catch (e: any) {
    console.error('[ai-tasks] Error listing or parsing modules:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// POST /ai-tasks/execute — execute an action directly
// POST /ai-tasks/execute — execute an action directly
app.post('/ai-tasks/execute', async (c) => {
  const body = await c.req.json();
  const { action, params, scope } = body;
  if (!action || !scope) {
    return c.json({ error: 'Missing action or scope' }, 400);
  }

  try {
    const result = await executeAITask(c.env, action, params || {}, scope);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /workspace/:scope/skills — Return parsed action index for app cache
app.get('/workspace/:scope/skills', async (c) => {
  const scope = c.req.param('scope');
  let modules = await listWorkspaceModules(c.env, scope);

  // If no modules in workspace, use core modules as fallback
  if (modules.length === 0) {
    modules = Object.keys(CORE_MODULES);
  }

  const actions: any[] = [];
  for (const mod of modules) {
    const content = await readWithFallback(c.env, scope, `skills/${mod}.md`);

    if (content) {
      const parsed = parseSkillMarkdown(content);
      for (const action of parsed.actions) {
        actions.push({
          name: action.name,
          module: mod,
          purpose: action.purpose,
          intents: action.intents,
          params: action.params,
          steps: action.steps.length,
          tool: action.steps[0]?.tool || 'custom',
          table: action.steps[0]?.table || '',
          type: action.steps[0]?.type || '',
        });
      }
    }
  }

  return c.json({ actions });
});

// POST /workspace/:scope/customize — AI reads + edits skill .md in S3
app.post('/workspace/:scope/customize', async (c) => {
  const scope = c.req.param('scope');
  const body = await c.req.json();
  const { moduleName, prompt, userInstruction } = body || {};

  if (!moduleName || !prompt) {
    return c.json({ error: 'Missing moduleName or prompt' }, 400);
  }

  const filename = `skills/${moduleName}.md`;
  const content = await readWithFallback(c.env, scope, filename);

  if (!content) {
    return c.json({ error: `Module ${moduleName} not found` }, 404);
  }

  const groqKey = c.env.GROQ_API_KEY;
  if (!groqKey) {
    return c.json({ error: 'Groq API Key not configured' }, 500);
  }

  try {
    const systemPrompt = `You are an AI expert at writing and customizing OKF (Open Knowledge Format) markdown skill files.
You will modify the given markdown file based on the user's instructions.
Rules:
1. Preserve all markdown structure, YAML frontmatter, action steps (like read/create/update), and tool calls.
2. Ensure every step has clear tool, table/type/scope, and params.
3. Make only the changes requested by the user. Do not delete other existing actions unless requested.
4. Return ONLY the modified markdown file content. Do not include any chat formatting, explanations, or backticks enclosing the file.`;

    const userPrompt = `Existing Markdown Skill File:
---
${content}
---

User Instruction:
${userInstruction || prompt}

Please modify the markdown and output the complete updated markdown file.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    const data = await res.json() as any;
    const updatedContent = data?.choices?.[0]?.message?.content;
    if (!updatedContent) {
      return c.json({ error: 'LLM returned empty response' }, 500);
    }

    await uploadWorkspaceFile(c.env, scope, filename, updatedContent.trim());

    if (c.env.STOREFRONT_CACHE) {
      await c.env.STOREFRONT_CACHE.delete(`ai-tasks:${scope}`);
    }

    return c.json({ success: true, module: moduleName });
  } catch (err: any) {
    console.error('[customize] Error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================
// Workspace Event + Inbox Routes
// ============================================================

// POST /workspace/:scope/events — write event to motion table, trigger inbox rules
app.post('/workspace/:scope/events', async (c) => {
  const scope = c.req.param('scope');
  const body = await c.req.json();
  const { type, data, created_by } = body || {};

  if (!type) {
    return c.json({ error: 'Missing event type' }, 400);
  }

  // Resolve workspace DB
  const subdomain = scope.replace('w:', '');
  let dbUrl = '';
  let dbToken = '';

  if (c.env.DB) {
    try {
      const ws = await c.env.DB.prepare(
        'SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(subdomain).first();

      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (c.env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(c.env.DB, subdomain, scope, c.env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    } catch (err) {
      console.warn('[events] Failed to resolve workspace DB:', err);
    }
  }

  if (!dbUrl) {
    return c.json({ error: 'Workspace database not available' }, 500);
  }

  try {
    const result = await writeEvent(dbUrl, dbToken, {
      type,
      data: data || {},
      created_by: created_by || c.req.header('X-User-Id') || 'system',
      scope,
    });
    return c.json({ ok: true, eventId: result.id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /workspace/:scope/inbox — return pending tasks for user
app.get('/workspace/:scope/inbox', async (c) => {
  const scope = c.req.param('scope');
  const userId = c.req.query('userId') || c.req.header('X-User-Id') || 'guest';
  const limit = parseInt(c.req.query('limit') || '50');

  const subdomain = scope.replace('w:', '');
  let dbUrl = '';
  let dbToken = '';

  if (c.env.DB) {
    try {
      const ws = await c.env.DB.prepare(
        'SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(subdomain).first();

      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (c.env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(c.env.DB, subdomain, scope, c.env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    } catch (err) {
      console.warn('[inbox] Failed to resolve workspace DB:', err);
    }
  }

  if (!dbUrl) {
    return c.json({ tasks: [] });
  }

  try {
    const tasks = await getUserInbox(dbUrl, dbToken, userId, limit);
    return c.json({ tasks });
  } catch (e: any) {
    return c.json({ tasks: [], error: e.message });
  }
});

// PATCH /inbox/:taskId — mark task done
app.patch('/inbox/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  const body = await c.req.json().catch(() => ({}));
  const scope = body.scope || '';

  if (!scope) {
    return c.json({ error: 'Missing scope' }, 400);
  }

  const subdomain = scope.replace('w:', '');
  let dbUrl = '';
  let dbToken = '';

  if (c.env.DB) {
    try {
      const ws = await c.env.DB.prepare(
        'SELECT turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(subdomain).first();

      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (c.env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(c.env.DB, subdomain, scope, c.env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    } catch (err) {
      console.warn('[inbox] Failed to resolve workspace DB:', err);
    }
  }

  if (!dbUrl) {
    return c.json({ error: 'Workspace database not available' }, 500);
  }

  try {
    await markTaskDone(dbUrl, dbToken, taskId);
    return c.json({ ok: true });
  } catch (e: any) {
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

// GET /files/* — serve R2/S3 files directly
app.get('/files/*', async (c) => {
  const key = c.req.path.replace(/^\/files\//, '');
  if (c.env.BUCKET) {
    const obj = await c.env.BUCKET.get(key);
    if (!obj) return c.text('File not found', 404);
    c.header('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
    return c.body(obj.body);
  }

  // Fallback to external S3
  try {
    const { s3Get } = await import('./lib/s3-client');
    const text = await s3Get(c.env, key);
    if (text === null) return c.text('File not found', 404);
    c.header('Content-Type', 'application/json');
    return c.text(text);
  } catch (err: any) {
    return c.text(`S3 GET failed: ${err.message}`, 500);
  }
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
  const content = await readWithFallback(c.env, scope, path);
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

// POST /canvas/add — add skill/block to active canvas
app.post('/canvas/add', async (c) => {
  const body = await c.req.json();
  const { scope, block, module: modName } = body || {};
  if (!scope || (!block && !modName)) {
    return c.json({ error: 'Missing scope and block/module' }, 400);
  }
  try {
    const res = await addCanvasBlock(c.env, scope, block || modName);
    return c.json({ ok: true, ...res });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /canvas/remove — remove skill/block from active canvas
app.post('/canvas/remove', async (c) => {
  const body = await c.req.json();
  const { scope, module: modName, title } = body || {};
  if (!scope || (!modName && !title)) {
    return c.json({ error: 'Missing scope and module/title' }, 400);
  }
  try {
    const res = await removeCanvasBlock(c.env, scope, modName || title);
    return c.json({ ok: true, ...res });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================
// Memory Routes
// ============================================================

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

const BASE_SYSTEM_PROMPT = `You are a business assistant.

RESPONSE FORMAT:
When user wants to DO something, respond with ONLY:
{"action":"action_name","params":{"key":"value"}}

For questions/greetings, respond with plain text.
If params are missing, ask a follow-up.`;

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

  // Look up workspace scope
  let workspaceScope = scope;
  if (!workspaceScope) {
    const ws = await c.env.DB.prepare(
      'SELECT scope FROM workspaces WHERE user_id = ? LIMIT 1'
    ).bind(userId).first();
    if (ws) {
      workspaceScope = ws.scope;
    }
  }

  // Load and parse skills
  const parsedSkills = [];
  if (workspaceScope) {
    try {
      const modules = await listWorkspaceModules(c.env, workspaceScope);
      for (const mod of modules) {
        const content = await readWorkspaceFile(c.env, workspaceScope, `skills/${mod}.md`);
        if (content) {
          parsedSkills.push(parseSkillMarkdown(content));
        }
      }
    } catch (err) {
      console.warn('[Agent] Failed to read workspace modules:', err);
    }
  }

  // Fallback to core modules if no workspace skills loaded
  if (parsedSkills.length === 0) {
    for (const [modName, modContent] of Object.entries(CORE_MODULES)) {
      parsedSkills.push(parseSkillMarkdown(modContent));
    }
  }

  const compactIndex = generateCompactActionIndex(parsedSkills);
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nAVAILABLE AI TASKS:\n${compactIndex}`;

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

    // Try to parse as action call — strip code blocks if present
    let actionCall = null;
    try {
      let cleanReply = reply.trim();
      cleanReply = cleanReply.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleanReply);
      if (parsed.action && parsed.action.startsWith('action_')) {
        actionCall = parsed;
      }
    } catch {
      try {
        const jsonMatch = reply.match(/\{[\s\S]*"action"\s*:\s*"action_[a-zA-Z0-9_]+"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.action && parsed.action.startsWith('action_')) {
            actionCall = parsed;
          }
        }
      } catch {}
    }

    // Execute AI Task if present
    let executorResult = null;
    if (actionCall && workspaceScope) {
      try {
        executorResult = await executeAITask(
          c.env,
          actionCall.action,
          actionCall.params || {},
          workspaceScope
        );
      } catch (e: any) {
        executorResult = { success: false, error: e.message };
      }
    }

    // Build friendly reply
    let finalReply = reply;
    if (actionCall) {
      if (executorResult?.success) {
        // Find if we created a matter
        const createHistory = executorResult.history.find((h: any) => h.raw.includes('create(') && h.raw.includes("table='matter'"));
        if (createHistory && createHistory.result && createHistory.result.id) {
          const typeMatch = createHistory.raw.match(/type='([a-zA-Z0-9_]+)'/);
          const entityType = typeMatch ? typeMatch[1] : 'item';
          finalReply = `Executed ${actionCall.action} successfully. Created ${entityType} ID: ${createHistory.result.id}`;
        } else {
          finalReply = `Executed ${actionCall.action} successfully.`;
        }
      } else {
        finalReply = `Failed to execute ${actionCall.action}: ${executorResult?.error || 'unknown error'}`;
      }
    }

    return c.json({
      reply: finalReply,
      sessionId,
      actionCall,
      executorResult,
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
  try {
    const body = await c.req.json();
    const { handleTelegramUpdate, sendTelegramMessage } = await import('./channels/telegram');
    const result = await handleTelegramUpdate(body, { DB: c.env.DB });
    if (!result) return c.json({ ok: true });

    // Send response back to Telegram chat
    const botToken = c.env?.TELEGRAM_BOT_TOKEN || process.env?.TELEGRAM_BOT_TOKEN;
    await sendTelegramMessage({ platform: 'telegram', botToken }, result.response);

    return c.json({ ok: true, response: result.response.text });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return c.json({ ok: false, error: err.message }, 200);
  }
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
  try {
    const signature = c.req.header('x-signature-ed25519') || null;
    const timestamp = c.req.header('x-signature-timestamp') || null;
    const rawBody = await c.req.text();
    const publicKey = c.env?.DISCORD_PUBLIC_KEY || process.env?.DISCORD_PUBLIC_KEY;

    const { verifyDiscordKey, processDiscordMessage } = await import('./channels/discord');

    const isValid = await verifyDiscordKey(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return c.text('Invalid request signature', 401);
    }

    const body = rawBody ? JSON.parse(rawBody) : {};

    // Discord PING verification (type 1)
    if (body.type === 1) {
      return c.json({ type: 1 });
    }

    const replyText = await processDiscordMessage(body, c.env);

    return c.json({
      type: 4,
      data: { content: replyText || 'Message received' }
    });
  } catch (err: any) {
    console.error('[Discord Webhook Error]:', err);
    return c.json({ type: 1 });
  }
});

// POST /channels/google-chat/webhook
app.post('/channels/google-chat/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const { handleGoogleChatEvent, formatGoogleChatResponse } = await import('./channels/google-chat');
    const message = handleGoogleChatEvent(body);
    
    if (!message) return c.json({});

    // Process message with AI or motion dispatcher
    const replyText = `Hello ${message.userName}, I received your message: "${message.content}"`;
    return c.json(formatGoogleChatResponse(replyText));
  } catch (err: any) {
    console.error('[Google Chat Webhook Error]:', err);
    return c.json({ text: 'An error occurred while processing your message.' });
  }
});


// Workspace site routes (only for *.tarai.space)
app.notFound(async (c) => {
  const url = new URL(c.req.url);
  const host = url.hostname;
  
  let workspaceSlug = '';
  const workspaceMatch = host.match(/^([a-z0-9-]+)\.tarai\.space$/);
  if (workspaceMatch) {
    workspaceSlug = workspaceMatch[1];
    const reserved = ['api', 'admin', 'dashboard', 'assets', 'www', 'taragent'];
    if (reserved.includes(workspaceSlug)) {
      return c.text('API Endpoint', 404);
    }
  }

  let ws: any = null;
  if (c.env.DB) {
    if (workspaceSlug) {
      ws = await c.env.DB.prepare(
        'SELECT subdomain, turso_url, turso_auth_token FROM workspaces WHERE subdomain = ?'
      ).bind(workspaceSlug).first();
    } else {
      ws = await c.env.DB.prepare(
        'SELECT subdomain, turso_url, turso_auth_token FROM workspaces WHERE custom_domain = ?'
      ).bind(host).first();
      if (ws) {
        workspaceSlug = ws.subdomain;
      }
    }
  }

  if (!workspaceSlug) return c.text('Not found', 404);
  const scope = `w:${workspaceSlug}`;

  const method = c.req.method;
  const pathname = url.pathname;

  // Handle Form Submissions from Edge Site Engine
  if (method === 'POST') {
    let dbUrl = '';
    let dbToken = '';

    if (c.env.DB) {
      if (ws?.turso_url && ws?.turso_auth_token) {
        dbUrl = ws.turso_url;
        dbToken = ws.turso_auth_token;
      } else if (c.env.TURSO_PLATFORM_TOKEN) {
        const credentials = await getOrCreateWorkspaceDb(c.env.DB, workspaceSlug, scope, c.env.TURSO_PLATFORM_TOKEN);
        dbUrl = credentials.url;
        dbToken = credentials.authToken;
      }
    }

    const runQuery = async (fn: () => Promise<any>) => {
      if (dbUrl) {
        return dbContext.run({ url: dbUrl, token: dbToken }, fn);
      }
      return fn();
    };

    // Public Form Submissions (Order, Booking, Contact)

    if (pathname === '/api/order') {
      const body = await c.req.json();
      const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      await runQuery(async () => {
        await executeCreate({
          table: 'matter',
          id: orderId,
          type: 'order',
          scope,
          title: `Order for ${body.email || 'customer'}`,
          data: {
            items: body.items,
            email: body.email || '',
            name: body.name || '',
            address: body.address || '',
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        });

        await executeCreate({
          table: 'motion',
          stream: orderId,
          action: 10001, // order_created
          data: {
            orderId,
            items: body.items,
            status: 'pending'
          }
        });
      });

      return c.json({ ok: true, orderId });
    }

    if (pathname === '/api/booking') {
      const body = await c.req.json();
      const bookingId = `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      await runQuery(async () => {
        await executeCreate({
          table: 'matter',
          id: bookingId,
          type: 'booking',
          scope,
          title: `Booking for ${body.name || 'customer'}`,
          data: {
            service: body.service,
            date: body.date,
            slot: body.slot,
            name: body.name,
            status: 'confirmed',
            createdAt: new Date().toISOString()
          }
        });

        await executeCreate({
          table: 'motion',
          stream: bookingId,
          action: 10002, // booking_created
          data: {
            bookingId,
            service: body.service,
            date: body.date,
            slot: body.slot,
            status: 'confirmed'
          }
        });
      });

      return c.json({ ok: true, bookingId });
    }

    if (pathname === '/api/contact') {
      const body = await c.req.json();
      const contactId = `ct_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      await runQuery(async () => {
        await executeCreate({
          table: 'matter',
          id: contactId,
          type: 'customer',
          scope,
          title: `Contact from ${body.name || 'customer'}`,
          data: {
            name: body.name,
            info: body.info,
            message: body.message,
            createdAt: new Date().toISOString()
          }
        });
      });

      return c.json({ ok: true, contactId });
    }
  }

  return c.json({ message: `TAR Agent API service for workspace ${workspaceSlug}` });
});

export default app;
