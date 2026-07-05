/**
 * JSON Action definitions — stored as form rows with type='action'.
 * Agent calls these via the 6 generic tools.
 */

export interface ActionStep {
  tool: 'create' | 'read' | 'update' | 'delete' | 'link' | 'search';
  table?: string;
  type?: string;
  form?: string;
  scope?: string;
  title?: string;
  value?: number;
  qty?: number;
  unit?: string;
  data?: Record<string, any>;
  src?: string;
  rel?: string;
  tgt?: string;
  text?: string;
  stream?: string;
  action?: number;
  phase?: number;
  patch?: Record<string, any>;
  id?: string;
  filters?: Array<{ key: string; val: any }>;
  limit?: number;
  // Variable substitution: "$.paramName" references input params
  // "$.result.stepId.field" references results from previous steps
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  vertical: string;
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
  }>;
  steps: ActionStep[];
  // Output template for agent response
  outputTemplate?: string;
}

/**
 * Result from executing a single step
 */
export interface StepResult {
  stepId: string;
  [key: string]: any;
}
