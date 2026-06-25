import type { ActionDef } from './definitions';
import { BUILT_IN_ACTIONS } from './seed';

interface DbLike {
  runAsync(query: string, ...params: any[]): Promise<void>;
}

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface ExecutionStep {
  id: number;
  label: string;
  detail: string;
  status: StepStatus;
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface ExecutionState {
  actionId: string;
  actionName: string;
  steps: ExecutionStep[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalMs?: number;
  errorMessage?: string;
  result?: { id: string; title: string };
}

export type OnStepUpdate = (state: ExecutionState) => void;

function cloneSteps(state: ExecutionState): ExecutionStep[] {
  return state.steps.map((s) => ({ ...s }));
}

function buildSteps(action: ActionDef): ExecutionStep[] {
  const steps: ExecutionStep[] = [
    { id: 0, label: 'Validate input', detail: 'Checking required fields', status: 'pending' },
  ];

  // Resolve programmatic execute if it is a built-in action
  let execFn = action.execute;
  if (!execFn && action.id.startsWith('tool_')) {
    const builtin = BUILT_IN_ACTIONS.find((a) => a.id === action.id);
    if (builtin) execFn = builtin.execute;
  }

  if (execFn) {
    steps.push({ id: 1, label: 'Process data', detail: 'Running action logic', status: 'pending' });
    steps.push({ id: 2, label: 'Save record', detail: 'Writing to database', status: 'pending' });
  } else if (action.creates) {
    steps.push({ id: 1, label: 'Build record', detail: `Preparing ${action.creates.table} entry`, status: 'pending' });
    steps.push({ id: 2, label: 'Save record', detail: `Writing to ${action.creates.table} table`, status: 'pending' });
  } else {
    steps.push({ id: 1, label: 'Execute', detail: action.name, status: 'pending' });
  }

  return steps;
}

export function createInitialState(action: ActionDef): ExecutionState {
  return {
    actionId: action.id,
    actionName: action.name,
    steps: buildSteps(action),
    status: 'idle',
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runActionExecution(
  db: DbLike,
  action: ActionDef,
  values: Record<string, any>,
  onUpdate: OnStepUpdate,
  signal?: AbortSignal
): Promise<{ id: string; title: string }> {
  const state = createInitialState(action);
  state.status = 'running';
  const start = Date.now();

  const emit = () => onUpdate({ ...state, steps: cloneSteps(state) });

  const failStep = (idx: number, msg: string) => {
    state.steps[idx].status = 'failed';
    state.steps[idx].error = msg;
    state.steps[idx].durationMs = Date.now() - start;
    state.status = 'failed';
    state.totalMs = Date.now() - start;
    state.errorMessage = msg;
    emit();
  };

  const check = () => {
    if (signal?.aborted) throw new Error('_cancelled');
  };

  emit();

  try {
    // Step 0: Validate
    check();
    state.steps[0].status = 'running';
    emit();

    const missing = action.fields.filter((f) => f.required && !values[f.name]);
    if (missing.length > 0) {
      failStep(0, `Missing: ${missing.map((f) => f.label).join(', ')}`);
      return Promise.reject(new Error(state.errorMessage!));
    }

    state.steps[0].status = 'success';
    state.steps[0].result = 'All fields valid';
    state.steps[0].durationMs = Date.now() - start;
    emit();
    await delay(80);

    // Step 1: Process
    check();
    state.steps[1].status = 'running';
    emit();

    let result: { id: string; title: string };

    // Resolve programmatic execute if it is a built-in action
    let execFn = action.execute;
    if (!execFn && action.id.startsWith('tool_')) {
      const builtin = BUILT_IN_ACTIONS.find((a) => a.id === action.id);
      if (builtin) execFn = builtin.execute;
    }

    if (execFn) {
      const execResult = execFn(values);
      state.steps[1].status = 'success';
      state.steps[1].result = `Built: "${execResult.title}"`;
      state.steps[1].durationMs = Date.now() - start;
      emit();
      await delay(60);

      // Step 2: Save
      check();
      state.steps[2].status = 'running';
      emit();

      const id = `form_${execResult.formType}_${Date.now()}`;
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        id, execResult.formType, execResult.title, execResult.formScope,
        JSON.stringify(execResult.data), now
      );

      state.steps[2].status = 'success';
      state.steps[2].result = `Saved as ${id}`;
      state.steps[2].durationMs = Date.now() - start;
      result = { id, title: execResult.title };

    } else if (action.creates) {
      const c = action.creates;
      const formType = c.formType || action.id.replace(/^tool_/, '').replace(/_/g, '-');
      const formScope = c.formScope || 'p';

      let title: string;
      if (c.titleTemplate) {
        title = c.titleTemplate.replace(/\{(\w+)\}/g, (_, f) => String(values[f] || ''));
      } else if (c.titleField) {
        title = String(values[c.titleField] || action.name);
      } else {
        title = action.name;
      }

      const dataFields = c.dataFields || Object.keys(values);
      const data: Record<string, any> = {};
      for (const f of dataFields) {
        if (values[f] !== undefined && values[f] !== null && values[f] !== '') {
          data[f] = values[f];
        }
      }

      state.steps[1].status = 'success';
      state.steps[1].result = `Type: ${formType}`;
      state.steps[1].durationMs = Date.now() - start;
      emit();
      await delay(60);

      // Step 2: Save
      check();
      state.steps[2].status = 'running';
      emit();

      const id = `form_${formType}_${Date.now()}`;
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        id, formType, title, formScope, JSON.stringify(data), now
      );

      state.steps[2].status = 'success';
      state.steps[2].result = `Saved as ${id}`;
      state.steps[2].durationMs = Date.now() - start;
      result = { id, title };

    } else {
      throw new Error('Action has no execute function or creates mapping');
    }

    state.status = 'completed';
    state.totalMs = Date.now() - start;
    state.result = result;
    emit();

    return result;

  } catch (e: any) {
    if (e.message === '_cancelled') {
      state.status = 'cancelled';
      for (const s of state.steps) {
        if (s.status === 'pending' || s.status === 'running') s.status = 'skipped';
      }
      state.totalMs = Date.now() - start;
      emit();
      throw new Error('cancelled');
    }
    const idx = state.steps.findIndex((s) => s.status === 'running');
    if (idx >= 0 && state.steps[idx].status !== 'failed') {
      failStep(idx, e.message || 'Unknown error');
    }
    throw e;
  }
}

