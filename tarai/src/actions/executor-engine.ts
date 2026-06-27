import type { ActionDef } from './definitions';
import { executeAction } from './executor';

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
  return [
    { id: 0, label: 'Validate input', detail: 'Checking required fields', status: 'pending' },
    { id: 1, label: 'Process data', detail: 'Running action logic', status: 'pending' },
    { id: 2, label: 'Save record', detail: 'Writing to database', status: 'pending' },
  ];
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
  db: any, // kept for backward-compatibility in signature
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

    const result = await executeAction(action, values);

    state.steps[1].status = 'success';
    state.steps[1].result = `Built: "${result.title}"`;
    state.steps[1].durationMs = Date.now() - start;
    emit();
    await delay(60);

    // Step 2: Save
    check();
    state.steps[2].status = 'running';
    emit();

    state.steps[2].status = 'success';
    state.steps[2].result = `Saved as ${result.id}`;
    state.steps[2].durationMs = Date.now() - start;

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
