import type { SkillDef } from './definitions';

interface DbLike {
  runAsync(query: string, ...params: any[]): Promise<void>;
}

/**
 * Generic skill executor. Built-in skills provide their own `execute` function;
 * custom (AI-generated) skills drive via the `creates` mapping.
 *
 * v1: supports `creates.table === 'form'` only. matter/motion are documented
 * extension points (matter needs a form FK).
 */
export async function executeSkill(
  db: DbLike,
  skill: SkillDef,
  values: Record<string, any>
): Promise<{ id: string; title: string }> {
  if (skill.execute) {
    const result = skill.execute(values);
    const id = `form_${result.formType}_${Date.now()}`;
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, result.formType, result.title, result.formScope, JSON.stringify(result.data), now
    );
    console.log(`[EXEC] built-in ${skill.id} → ${id}`);
    return { id, title: result.title };
  }

  if (skill.creates) {
    return executeFromCreates(db, skill, values);
  }

  throw new Error(`Skill ${skill.id} has no execute function or creates mapping`);
}

function executeFromCreates(
  db: DbLike,
  skill: SkillDef,
  values: Record<string, any>
): Promise<{ id: string; title: string }> {
  const creates = skill.creates!;

  if (creates.table !== 'form') {
    throw new Error(`creates.table '${creates.table}' not yet supported (v1 is form-only)`);
  }

  const formType = creates.formType || skill.id.replace(/^tool_/, '').replace(/_/g, '-');
  const formScope = creates.formScope || 'p';

  // Build title from template or titleField
  let title: string;
  if (creates.titleTemplate) {
    title = creates.titleTemplate.replace(/\{(\w+)\}/g, (_, field) => String(values[field] || ''));
  } else if (creates.titleField) {
    title = String(values[creates.titleField] || skill.name);
  } else {
    title = skill.name;
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

  console.log(`[EXEC] custom ${skill.id} → ${id} (type=${formType})`);
  return Promise.resolve({ id, title });
}
