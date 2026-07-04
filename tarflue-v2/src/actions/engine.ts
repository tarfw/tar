/**
 * Action Execution Engine — runs JSON action and workflow definitions.
 * Supports: sequential steps, conditional branches, parallel execution.
 */

import { executeCreate, executeRead, executeUpdate, executeDelete, executeLink, executeSearch } from '../lib/helpers';
import type { ActionDefinition, ActionStep, StepResult } from './types';

export interface WorkflowStep {
  // Sequential step
  action?: ActionStep;
  // Conditional branch
  if?: string;
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  // Parallel execution
  parallel?: WorkflowStep[];
  // Loop
  loop?: {
    over: string; // variable name containing array
    do: WorkflowStep[];
  };
  // Sub-workflow
  workflow?: string;
  call?: string; // action ID to call
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  input?: Array<{ name: string; type: string; required?: boolean }>;
}

/**
 * Resolve variable references in a step's fields.
 * "$.paramName" → input[paramName]
 * "$.results.stepId.field" → results[stepId][field]
 */
function resolveValue(
  value: any,
  input: Record<string, any>,
  results: Record<string, StepResult>
): any {
  if (typeof value === 'string' && value.startsWith('$.results.')) {
    const parts = value.split('.');
    const stepId = parts[1];
    const field = parts.slice(2).join('.');
    return results[stepId]?.[field] ?? value;
  }
  if (typeof value === 'string' && value.startsWith('$.')) {
    const key = value.slice(2);
    return input[key] ?? value;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v, input, results);
    }
    return resolved;
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveValue(v, input, results));
  }
  return value;
}

/**
 * Resolve all fields in a step
 */
function resolveStep(
  step: ActionStep,
  input: Record<string, any>,
  results: Record<string, StepResult>
): ActionStep {
  const resolved: any = {};
  for (const [key, val] of Object.entries(step)) {
    resolved[key] = resolveValue(val, input, results);
  }
  return resolved;
}

/**
 * Execute a single action step
 */
async function executeStep(
  step: ActionStep,
  input: Record<string, any>,
  results: Record<string, StepResult>
): Promise<StepResult> {
  const resolved = resolveStep(step, input, results);
  const stepId = `step_${Object.keys(results).length}`;

  switch (resolved.tool) {
    case 'create': {
      const result = await executeCreate(resolved);
      return { stepId, ...result };
    }
    case 'read': {
      const result = await executeRead(resolved);
      return { stepId, ...result };
    }
    case 'update': {
      const result = await executeUpdate(resolved);
      return { stepId, ...result };
    }
    case 'delete': {
      const result = await executeDelete(resolved);
      return { stepId, ...result };
    }
    case 'link': {
      const result = await executeLink(resolved);
      return { stepId, ...result };
    }
    case 'search': {
      const result = await executeSearch(resolved);
      return { stepId, ...result };
    }
    default:
      return { stepId, error: `Unknown tool: ${resolved.tool}` };
  }
}

/**
 * Evaluate a condition string against current state
 */
function evaluateCondition(
  condition: string,
  input: Record<string, any>,
  results: Record<string, StepResult>
): boolean {
  const resolved = resolveValue(condition, input, results);

  // Simple comparisons: "$.stock > 0", "$.count == 0"
  if (typeof resolved === 'string') {
    const match = resolved.match(/^\$\.(\w+)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
    if (match) {
      const [, key, op, valStr] = match;
      const left = input[key] ?? results[key]?.count ?? 0;
      const right = isNaN(Number(valStr)) ? valStr : Number(valStr);
      switch (op) {
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': return left == right;
        case '!=': return left != right;
      }
    }
    // Truthy check: "$.items" → if input.items is truthy
    if (resolved.startsWith('$.')) {
      const key = resolved.slice(2);
      return Boolean(input[key]);
    }
    return Boolean(resolved);
  }

  return Boolean(resolved);
}

/**
 * Execute workflow steps (supports sequential, conditional, parallel, loop)
 */
async function executeWorkflowSteps(
  steps: WorkflowStep[],
  input: Record<string, any>,
  results: Record<string, StepResult>
): Promise<StepResult[]> {
  const output: StepResult[] = [];

  for (const step of steps) {
    // Sequential action step
    if (step.action) {
      const result = await executeStep(step.action, input, results);
      results[result.stepId] = result;
      output.push(result);
      continue;
    }

    // Conditional branch
    if (step.if !== undefined) {
      const condition = evaluateCondition(step.if, input, results);
      const branch = condition ? step.then : step.else;
      if (branch) {
        const branchResults = await executeWorkflowSteps(branch, input, results);
        output.push(...branchResults);
      }
      continue;
    }

    // Parallel execution
    if (step.parallel) {
      const parallelResults = await Promise.all(
        step.parallel.map(subStep => executeWorkflowSteps([subStep], input, results))
      );
      for (const results of parallelResults) {
        output.push(...results);
      }
      continue;
    }

    // Loop
    if (step.loop) {
      const items = resolveValue(`$.${step.loop.over}`, input, results);
      if (Array.isArray(items)) {
        for (const item of items) {
          const loopInput = { ...input, _item: item };
          const loopResults = await executeWorkflowSteps(step.loop.do, loopInput, results);
          output.push(...loopResults);
        }
      }
      continue;
    }
  }

  return output;
}

/**
 * Execute a full action definition
 */
export async function executeAction(
  action: ActionDefinition,
  input: Record<string, any>
): Promise<{ results: StepResult[]; output: string }> {
  const results: Record<string, StepResult> = {};
  const resultArray: StepResult[] = [];

  for (const step of action.steps) {
    const result = await executeStep(step, input, results);
    results[result.stepId] = result;
    resultArray.push(result);
  }

  // Build output from template or last result
  let output = '';
  if (action.outputTemplate) {
    output = resolveValue(action.outputTemplate, input, results) as string;
  } else {
    const lastResult = resultArray[resultArray.length - 1];
    if (lastResult?.id) {
      output = `Action completed. ID: ${lastResult.id}`;
    } else {
      output = 'Action completed.';
    }
  }

  return { results: resultArray, output };
}

/**
 * Execute a workflow definition
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  input: Record<string, any>
): Promise<{ results: StepResult[]; output: string }> {
  const results: Record<string, StepResult> = {};
  const resultArray = await executeWorkflowSteps(workflow.steps, input, results);

  return { results: resultArray, output: 'Workflow completed.' };
}

/**
 * Load an action definition from the form table
 */
export async function loadAction(
  actionId: string,
  scope: string
): Promise<ActionDefinition | null> {
  const result = await executeRead({
    table: 'form',
    id: actionId,
    scope,
    limit: 1,
  });

  const row = result.rows?.[0];
  if (!row) return null;

  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return {
    id: row.id,
    name: row.title || data?.name || actionId,
    description: data?.description || '',
    vertical: data?.vertical || 'general',
    fields: data?.fields || [],
    steps: data?.steps || [],
    outputTemplate: data?.outputTemplate,
  };
}

/**
 * Load a workflow definition from the form table
 */
export async function loadWorkflow(
  workflowId: string,
  scope: string
): Promise<WorkflowDefinition | null> {
  const result = await executeRead({
    table: 'form',
    id: workflowId,
    scope,
    limit: 1,
  });

  const row = result.rows?.[0];
  if (!row) return null;

  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return {
    id: row.id,
    name: row.title || data?.name || workflowId,
    steps: data?.steps || [],
    input: data?.input || [],
  };
}
