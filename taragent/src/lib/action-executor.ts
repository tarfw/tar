import { executeCreate, executeRead, executeUpdate, executeDelete } from './helpers';
import { listWorkspaceModules, readWorkspaceFile, listVerticalModules, readVerticalFile } from './okf';
import { parseSkillMarkdown, ParsedAction, ActionStep } from './skill-parser';

export interface AITaskResult {
  success: boolean;
  actionName: string;
  stepsExecuted: number;
  history: Array<{
    step: number;
    raw: string;
    result: any;
  }>;
  error?: string;
}

const TOOL_FUNCTIONS: Record<string, Function> = {
  create: executeCreate,
  read: executeRead,
  update: executeUpdate,
  delete: executeDelete,
  link: executeCreate,
};

function stripQuotes(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function evaluateValue(valStr: string, ctx: Record<string, any>): any {
  const trimmed = valStr.trim();
  
  // 1. Simple placeholder
  if (trimmed.startsWith('{') && trimmed.endsWith('}') && !trimmed.includes('{', 1)) {
    const varName = trimmed.slice(1, -1);
    if (varName in ctx) {
      return ctx[varName];
    }
  }

  // 2. String literal with single or double quotes
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    let inner = trimmed.slice(1, -1);
    return inner.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
      return varName in ctx ? String(ctx[varName]) : match;
    });
  }

  // 3. Object literal
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    let substituted = trimmed.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
      if (varName in ctx) {
        const v = ctx[varName];
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
      }
      return match;
    });

    let baseObject = {};
    if (substituted.includes('...')) {
      const spreadMatch = substituted.match(/\.\.\.([a-zA-Z0-9_]+)/);
      if (spreadMatch) {
        const spreadVar = spreadMatch[1];
        if (spreadVar in ctx && typeof ctx[spreadVar] === 'object') {
          baseObject = { ...ctx[spreadVar] };
        }
        substituted = substituted.replace(/\.\.\.[a-zA-Z0-9_]+,?\s*/g, '');
      }
    }

    try {
      let strictJson = substituted
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      
      const parsedObj = JSON.parse(strictJson);
      return { ...baseObject, ...parsedObj };
    } catch (err) {
      return substituted;
    }
  }

  // 4. Mathematical expression
  if (trimmed.includes('+') || trimmed.includes('-') || trimmed.includes('*') || trimmed.includes('/')) {
    let expr = trimmed;
    for (const key of Object.keys(ctx)) {
      const val = ctx[key];
      if (typeof val === 'number') {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
      }
    }
    try {
      if (/^[0-9\s.+\-*/()]+$/.test(expr)) {
        return Function(`"use strict"; return (${expr})`)();
      }
    } catch (err) {
      console.warn('[executor] Expression eval failed:', expr, err);
    }
  }

  // 5. Default fallback
  return trimmed.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
    return varName in ctx ? String(ctx[varName]) : match;
  });
}

function parseArgs(argsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentKey = '';
  let currentValue = '';
  let inKey = true;
  let braceCount = 0;
  let quoteChar: string | null = null;
  let i = 0;

  while (i < argsStr.length) {
    const char = argsStr[i];

    if (inKey) {
      if (char === '=' || char === ':') {
        inKey = false;
        currentKey = currentKey.trim();
      } else {
        currentKey += char;
      }
    } else {
      if (quoteChar) {
        if (char === quoteChar) {
          quoteChar = null;
        }
        currentValue += char;
      } else if (char === "'" || char === '"') {
        quoteChar = char;
        currentValue += char;
      } else if (char === '{') {
        braceCount++;
        currentValue += char;
      } else if (char === '}') {
        braceCount--;
        currentValue += char;
      } else if (char === ',' && braceCount === 0) {
        result[currentKey] = currentValue.trim();
        currentKey = '';
        currentValue = '';
        inKey = true;
      } else {
        currentValue += char;
      }
    }
    i++;
  }

  if (currentKey.trim()) {
    result[currentKey.trim()] = currentValue.trim();
  }

  return result;
}

function extractToolCalls(stepText: string): { tool: string; args: string }[] {
  const calls: { tool: string; args: string }[] = [];
  const tools = new Set(['create', 'read', 'update', 'delete', 'link']);
  let i = 0;

  while (i < stepText.length) {
    let foundTool: string | null = null;
    for (const tool of tools) {
      if (stepText.startsWith(`${tool}(`, i)) {
        foundTool = tool;
        break;
      }
    }

    if (foundTool) {
      const startIndex = i + foundTool.length + 1;
      let braceCount = 1;
      let j = startIndex;
      let quoteChar: string | null = null;
      while (j < stepText.length && braceCount > 0) {
        const char = stepText[j];
        if (quoteChar) {
          if (char === quoteChar) quoteChar = null;
        } else if (char === "'" || char === '"') {
          quoteChar = char;
        } else if (char === '(') {
          braceCount++;
        } else if (char === ')') {
          braceCount--;
        }
        j++;
      }
      if (braceCount === 0) {
        const args = stepText.slice(startIndex, j - 1);
        calls.push({ tool: foundTool, args });
        i = j;
        continue;
      }
    }
    i++;
  }
  return calls;
}

function parseActionStep(stepText: string): ActionStep {
  const calls = extractToolCalls(stepText);
  let tool = 'custom';
  let table = '';
  let type = '';
  let params: Record<string, string> = {};

  if (calls.length > 0) {
    tool = calls[0].tool;
    const parsedArgs = parseArgs(calls[0].args);
    table = stripQuotes(parsedArgs.table || '');
    type = stripQuotes(parsedArgs.type || '');
    params = parsedArgs;
  }

  return {
    tool,
    table: table || undefined,
    type: type || undefined,
    params,
    raw: stepText
  };
}

async function executeSingleStep(
  env: any,
  scope: string,
  step: ActionStep,
  context: Record<string, any>
): Promise<any> {
  const substitutedArgs: Record<string, any> = {};
  for (const [k, v] of Object.entries(step.params)) {
    substitutedArgs[k] = evaluateValue(v, context);
  }

  if (!substitutedArgs.scope) {
    substitutedArgs.scope = scope;
  }

  const handler = TOOL_FUNCTIONS[step.tool];
  let result;
  
  try {
    if (scope && scope.startsWith('w:')) {
      const workspaceId = scope.replace('w:', '');
      const stubId = env.WORKSPACE.idFromName(workspaceId);
      const stub = env.WORKSPACE.get(stubId);
      let toolInput = substitutedArgs;
      if (step.tool === 'link') {
        toolInput = { ...substitutedArgs, table: 'graph' };
      } else if (step.tool === 'update') {
        const table = substitutedArgs.table;
        const id = substitutedArgs.id;
        const s = substitutedArgs.scope || scope;
        const type = substitutedArgs.type;
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(substitutedArgs)) {
          if (k !== 'table' && k !== 'id' && k !== 'scope' && k !== 'type') {
            patch[k] = v;
          }
        }
        toolInput = { table, id, scope: s, type, patch };
      }
      
      const res = await stub.fetch(`http://do/tools/${step.tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolInput),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      result = await res.json();
    } else if (scope && scope.startsWith('o:')) {
      const orderId = scope.replace('o:', '');
      const stubId = env.ORDER.idFromName(orderId);
      const stub = env.ORDER.get(stubId);
      let toolInput = substitutedArgs;
      if (step.tool === 'link') {
        toolInput = { ...substitutedArgs, table: 'graph' };
      } else if (step.tool === 'update') {
        const table = substitutedArgs.table;
        const id = substitutedArgs.id;
        const s = substitutedArgs.scope || scope;
        const type = substitutedArgs.type;
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(substitutedArgs)) {
          if (k !== 'table' && k !== 'id' && k !== 'scope' && k !== 'type') {
            patch[k] = v;
          }
        }
        toolInput = { table, id, scope: s, type, patch };
      }
      
      const res = await stub.fetch(`http://do/tools/${step.tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolInput),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      result = await res.json();
    } else {
      if (!handler) {
        return { error: `Unsupported tool: ${step.tool}` };
      }
      if (step.tool === 'link') {
        substitutedArgs.table = 'graph';
        result = await executeCreate(substitutedArgs);
      } else if (step.tool === 'update') {
        const table = substitutedArgs.table;
        const id = substitutedArgs.id;
        const s = substitutedArgs.scope;
        const type = substitutedArgs.type;
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(substitutedArgs)) {
          if (k !== 'table' && k !== 'id' && k !== 'scope' && k !== 'type') {
            patch[k] = v;
          }
        }
        result = await executeUpdate({ table, id, scope: s, type, patch });
      } else {
        result = await handler(substitutedArgs);
      }
    }
  } catch (err: any) {
    if (err.message?.includes('TURSO_DATABASE_URL')) {
      if (step.tool === 'read') {
        result = { rows: [], count: 0 };
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // Capture result into context
  if (step.tool === 'create' || step.tool === 'link') {
    if (result && result.id) {
      context['id'] = result.id;
      if (substitutedArgs.type) {
        context[substitutedArgs.type + 'Id'] = result.id;
      }
    }
  } else if (step.tool === 'read') {
    if (result && result.rows && result.rows.length > 0) {
      context['lastRows'] = result.rows;
      context['currentQty'] = result.rows[0].qty;
      context['currentValue'] = result.rows[0].value;
      context['currentTitle'] = result.rows[0].title;
      context['currentData'] = result.rows[0].data || {};
    } else {
      context['lastRows'] = [];
    }
  }

  return result;
}

export async function executeAITask(
  env: any,
  actionName: string,
  params: Record<string, any>,
  scope: string
): Promise<AITaskResult> {
  // 1. Find the action definition from S3 or fallback vertical
  let modules = await listWorkspaceModules(env, scope);
  let isVerticalFallback = false;
  let vertical = 'restaurant';

  if (modules.length === 0) {
    if (env.DB) {
      const ws = await env.DB.prepare(
        'SELECT vertical FROM workspaces WHERE scope = ?'
      ).bind(scope).first();
      if (ws?.vertical) {
        vertical = ws.vertical;
      }
    }
    try {
      modules = await listVerticalModules(env, vertical);
      isVerticalFallback = true;
    } catch (err) {
      console.warn('[executor] Failed to list vertical modules:', err);
    }
  }

  let action: ParsedAction | null = null;
  for (const mod of modules) {
    const content = isVerticalFallback
      ? await readVerticalFile(env, vertical, `${mod}.md`)
      : await readWorkspaceFile(env, scope, `${mod}.md`);

    if (content) {
      const parsed = parseSkillMarkdown(content);
      const found = parsed.actions.find(a => a.name === actionName);
      if (found) {
        action = found;
        break;
      }
    }
  }

  if (!action) {
    return {
      success: false,
      actionName,
      stepsExecuted: 0,
      history: [],
      error: `Action '${actionName}' not found in any skill modules.`
    };
  }

  const context: Record<string, any> = { ...params };
  context['scope'] = scope;
  context['auto_id'] = String(Math.floor(Math.random() * 9000) + 1000);

  const history: Array<{ step: number; raw: string; result: any }> = [];
  let stepsExecuted = 0;

  try {
    for (let i = 0; i < action.steps.length; i++) {
      const step = action.steps[i];
      const rawText = step.raw;
      stepsExecuted++;

      // A. Check for loops
      const loopMatch = rawText.match(/^for\s+each\s+([a-zA-Z0-9_]+)\s*:\s*(.*)/i);
      const isForEachNoVar = rawText.toLowerCase().startsWith('for each:');

      if (loopMatch) {
        const loopVar = loopMatch[1]; // e.g. "item"
        const loopSubstepsText = loopMatch[2]; // e.g. "read(...) -> update(...)"
        const subSteps = loopSubstepsText.split(/->|→/).map(s => parseActionStep(s.trim()));

        // Look up array in context. We check "items", "leads", "products", etc.
        const listName = loopVar + 's';
        let list = context[listName] || context[loopVar];
        if (typeof list === 'string') {
          try {
            list = JSON.parse(list);
          } catch {
            list = list.split(',').map(s => s.trim());
          }
        }

        if (!Array.isArray(list)) {
          list = [list].filter(Boolean);
        }

        const loopResults = [];
        for (const element of list) {
          // Merge loop element into context frame
          const frameCtx = { ...context };
          if (typeof element === 'object' && element !== null) {
            Object.assign(frameCtx, element);
            // Also bind elements if they match names
            if (element.itemId) frameCtx['itemId'] = element.itemId;
            if (element.productId) frameCtx['productId'] = element.productId;
            if (element.qty) frameCtx['soldQty'] = element.qty;
            if (element.qty) frameCtx['itemQty'] = element.qty;
          } else {
            frameCtx[loopVar] = element;
            frameCtx[loopVar + 'Id'] = element;
            frameCtx['itemId'] = element;
            frameCtx['productId'] = element;
          }

          const frameHistory = [];
          for (const s of subSteps) {
            const res = await executeSingleStep(env, scope, s, frameCtx);
            frameHistory.push({ subStep: s.raw, result: res });
          }
          loopResults.push({ element, history: frameHistory });
        }

        history.push({ step: stepsExecuted, raw: rawText, result: loopResults });
      } else if (isForEachNoVar) {
        // Loop over context['lastRows']
        const loopSubstepsText = rawText.replace(/for\s+each\s*:\s*/i, '');
        const subSteps = loopSubstepsText.split(/->|→/).map(s => parseActionStep(s.trim()));
        const list = context['lastRows'] || [];

        const loopResults = [];
        for (const row of list) {
          const frameCtx = { ...context };
          frameCtx['productId'] = row.id;
          frameCtx['bookingId'] = row.id;
          frameCtx['leadId'] = row.id;
          frameCtx['orderId'] = row.id;
          frameCtx['title'] = row.title;
          frameCtx['qty'] = row.qty;
          frameCtx['minStock'] = row.data?.min_stock ?? 0;

          const frameHistory = [];
          for (const s of subSteps) {
            const res = await executeSingleStep(env, scope, s, frameCtx);
            frameHistory.push({ subStep: s.raw, result: res });
          }
          loopResults.push({ row, history: frameHistory });
        }

        history.push({ step: stepsExecuted, raw: rawText, result: loopResults });
      } else if (rawText.toLowerCase().startsWith('filter:')) {
        // Filter previous rows
        if (context['lastRows'] && Array.isArray(context['lastRows'])) {
          context['lastRows'] = context['lastRows'].filter((row: any) => {
            if (rawText.includes('qty <=') || rawText.includes('min_stock') || rawText.includes('minStock')) {
              return row.qty <= (row.data?.min_stock ?? 0);
            }
            return true;
          });
        }
        history.push({ step: stepsExecuted, raw: rawText, result: { filteredRowsCount: context['lastRows']?.length ?? 0 } });
      } else {
        // Regular single step
        const res = await executeSingleStep(env, scope, step, context);
        history.push({ step: stepsExecuted, raw: rawText, result: res });
      }
    }

    return {
      success: true,
      actionName,
      stepsExecuted,
      history
    };
  } catch (err: any) {
    return {
      success: false,
      actionName,
      stepsExecuted,
      history,
      error: err.message || String(err)
    };
  }
}
