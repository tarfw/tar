import { create } from '@/lib/tools';
import type { ActionDef } from './definitions';
import { BUILT_IN_ACTIONS } from './seed';

/**
 * Generic action executor routing actions to create instances (matters).
 */
export async function executeAction(
  action: ActionDef,
  values: Record<string, any>,
  clientRef?: string
): Promise<{ id: string; title: string }> {
  // Resolve programmatic execute if it is a built-in action
  let execFn = action.execute;
  if (!execFn && action.id.startsWith('tool_')) {
    const builtin = BUILT_IN_ACTIONS.find((a) => a.id === action.id);
    if (builtin) execFn = builtin.execute;
  }

  if (execFn) {
    const result = execFn(values);
    const formType = result.formType;
    const formScope = result.formScope || 'p';

    // Call unified create tool to create a matter record
    const createResult = await create({
      table: 'matter',
      scope: formScope,
      type: formType,
      form: formType, // Use type name as blueprint reference
      title: result.title,
      qty: typeof values.value === 'number' ? values.value : (typeof values.amount === 'number' ? values.amount : undefined),
      value: typeof values.value === 'number' ? values.value : (typeof values.amount === 'number' ? values.amount : undefined),
      data: result.data,
      client_ref: clientRef
    });

    console.log(`[EXEC] built-in ${action.id} → ${createResult.id} (matter)`);
    return { id: createResult.id, title: result.title };
  }

  if (action.creates) {
    const creates = action.creates;
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

    // Call unified create tool to create a matter record
    const createResult = await create({
      table: 'matter',
      scope: formScope,
      type: formType,
      form: formType,
      title: title,
      qty: typeof values.value === 'number' ? values.value : (typeof values.amount === 'number' ? values.amount : undefined),
      value: typeof values.value === 'number' ? values.value : (typeof values.amount === 'number' ? values.amount : undefined),
      data: data,
      client_ref: clientRef
    });

    console.log(`[EXEC] custom ${action.id} → ${createResult.id} (matter)`);
    return { id: createResult.id, title };
  }

  throw new Error(`Action ${action.id} has no execute function or creates mapping`);
}

