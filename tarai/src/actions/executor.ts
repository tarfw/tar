import type { ActionDef } from './definitions';
import { BUILT_IN_ACTIONS } from './seed';

interface DbLike {
  runAsync(query: string, ...params: any[]): Promise<void>;
}

/**
 * Generic action executor. Built-in actions provide their own `execute` function;
 * custom (AI-generated) actions drive via the `creates` mapping.
 *
 * v1: supports `creates.table === 'form'` only. matter/motion are documented
 * extension points (matter needs a form FK).
 */
export async function executeAction(
  db: DbLike,
  action: ActionDef,
  values: Record<string, any>
): Promise<{ id: string; title: string }> {
  // Resolve programmatic execute if it is a built-in action
  let execFn = action.execute;
  if (!execFn && action.id.startsWith('tool_')) {
    const builtin = BUILT_IN_ACTIONS.find((a) => a.id === action.id);
    if (builtin) execFn = builtin.execute;
  }

  if (execFn) {
    const result = execFn(values);
    const id = `form_${result.formType}_${Date.now()}`;
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, result.formType, result.title, result.formScope, JSON.stringify(result.data), now
    );
    console.log(`[EXEC] built-in ${action.id} → ${id}`);
    return { id, title: result.title };
  }

  if (action.creates) {
    return executeFromCreates(db, action, values);
  }

  throw new Error(`Action ${action.id} has no execute function or creates mapping`);
}

function executeFromCreates(
  db: DbLike,
  action: ActionDef,
  values: Record<string, any>
): Promise<{ id: string; title: string }> {
  const creates = action.creates!;

  if (creates.table !== 'form') {
    throw new Error(`creates.table '${creates.table}' not yet supported (v1 is form-only)`);
  }

  const formType = creates.formType || action.id.replace(/^tool_/, '').replace(/_/g, '-');
  const formScope = creates.formScope || 'p';

  // Build title from template or titleField
  let title: string;
  if (creates.titleTemplate) {
    title = creates.titleTemplate.replace(/\{(\w+)\}/g, (_, field) => String(values[field] || ''));
  } else if (creates.titleField) {
    title = String(values[creates.titleField] || action.name);
  } else {
    title = action.name;
  }

  // Build data from dataFields or all non-title values
  const dataFields = creates.dataFields || Object.keys(values);
  const data: Record<string, any> = {};
  for (const f of dataFields) {
    if (values[f] !== undefined && values[f] !== null && values[f] !== '') {
      data[f] = values[f];
    }
  }

  const id = `form_${formType}_${Date.now()}`;
  const now = new Date().toISOString();
  db.runAsync(
    'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
    id, formType, title, formScope, JSON.stringify(data), now
  );

  console.log(`[EXEC] custom ${action.id} → ${id} (type=${formType})`);
  return Promise.resolve({ id, title });
}

