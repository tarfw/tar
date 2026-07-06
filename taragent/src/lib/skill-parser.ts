export interface ParamDef {
  name: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
}

export interface ActionStep {
  tool: string;
  table?: string;
  type?: string;
  params: Record<string, string>;
  raw: string;
}

export interface ParsedAction {
  name: string;
  module: string;
  purpose: string;
  intents: string[];
  params: ParamDef[];
  steps: ActionStep[];
}

export interface ParsedSkill {
  name: string;
  version: string;
  tools: string[];
  actions: ParsedAction[];
}

function stripQuotes(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
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

export function parseSkillMarkdown(markdown: string): ParsedSkill {
  const lines = markdown.split(/\r?\n/);
  
  let name = '';
  let version = '';
  const tools: string[] = [];
  
  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let restLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      if (!inFrontmatter && frontmatterLines.length === 0 && i === 0) {
        inFrontmatter = true;
      } else {
        inFrontmatter = false;
      }
      continue;
    }

    if (inFrontmatter) {
      frontmatterLines.push(line);
    } else {
      restLines.push(line);
    }
  }

  // Parse frontmatter
  for (const line of frontmatterLines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      if (key === 'name' || key === 'module') {
        name = val;
      } else if (key === 'version') {
        version = val;
      } else if (key === 'tools') {
        // e.g. [create, read, update, delete, link]
        const cleanVal = val.replace('[', '').replace(']', '');
        tools.push(...cleanVal.split(',').map(t => t.trim()));
      }
    }
  }

  const actions: ParsedAction[] = [];
  let currentAction: Partial<ParsedAction> | null = null;
  let currentActionLines: string[] = [];
  
  let inIntentMatching = false;
  const intentsMap: Record<string, string[]> = {};

  for (const line of restLines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('## Intent Matching')) {
      inIntentMatching = true;
      continue;
    }

    if (inIntentMatching) {
      // Parse markdown table rows
      if (trimmed.startsWith('|') && !trimmed.includes('---|---') && !trimmed.includes('User says')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const userSays = cells[0];
          const actionName = cells[1];
          const triggers = userSays.split(/[/,;]/).map(t => t.trim()).filter(Boolean);
          if (!intentsMap[actionName]) {
            intentsMap[actionName] = [];
          }
          intentsMap[actionName].push(...triggers);
        }
      }
      continue;
    }

    if (trimmed.startsWith('### action_')) {
      if (currentAction) {
        actions.push(finalizeAction(currentAction, currentActionLines, name));
      }
      const actionName = trimmed.replace('###', '').trim();
      currentAction = {
        name: actionName,
        module: name,
        purpose: '',
        intents: [],
        params: [],
        steps: []
      };
      currentActionLines = [];
    } else if (currentAction) {
      currentActionLines.push(line);
    }
  }

  if (currentAction) {
    actions.push(finalizeAction(currentAction, currentActionLines, name));
  }

  // Populate intents from matching table
  for (const action of actions) {
    if (intentsMap[action.name]) {
      // Remove duplicates
      action.intents = Array.from(new Set(intentsMap[action.name]));
    }
  }

  return {
    name,
    version,
    tools,
    actions
  };
}

function finalizeAction(
  action: Partial<ParsedAction>,
  lines: string[],
  moduleName: string
): ParsedAction {
  let purpose = '';
  const steps: ActionStep[] = [];
  let inSteps = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    if (trimmed.toLowerCase().startsWith('steps:')) {
      inSteps = true;
      continue;
    }

    if (inSteps) {
      // Check if it looks like a step: "1. create(...)"
      const stepMatch = trimmed.match(/^\d+\.\s*(.*)/);
      if (stepMatch) {
        steps.push(parseActionStep(stepMatch[1]));
      }
    } else {
      // Purpose can be multiple lines, join them
      if (purpose) {
        purpose += ' ' + trimmed;
      } else {
        purpose = trimmed;
      }
    }
  }

  // Parameter extraction
  const params: ParamDef[] = [];
  const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
  const seenParams = new Set<string>();

  const numberParamKeywords = new Set([
    'total', 'value', 'amount', 'price', 'cost', 'mrp', 'min', 'qty',
    'quantity', 'soldqty', 'addedqty', 'size', 'party_size', 'count',
    'year', 'month', 'size_bytes', 'bytes'
  ]);

  const optionalParamKeywords = new Set([
    'notes', 'source', 'method', 'payment_method', 'txn', 'txnid',
    'unit', 'cost', 'mrp', 'min'
  ]);

  // We need to trace step-by-step to distinguish previous step references
  // from user parameters.
  // Created resource types in previous steps:
  const createdTypes = new Set<string>();

  for (let sIdx = 0; sIdx < steps.length; sIdx++) {
    const step = steps[sIdx];
    let match;
    
    // Find all placeholders in this step's raw text
    const stepPlaceholders: string[] = [];
    placeholderRegex.lastIndex = 0;
    while ((match = placeholderRegex.exec(step.raw)) !== null) {
      stepPlaceholders.push(match[1]);
    }

    for (const pName of stepPlaceholders) {
      const lowerPName = pName.toLowerCase();

      // System parameters
      if (lowerPName === 'scope' || lowerPName === 'auto_id') {
        continue;
      }

      // Direct ID reference
      if (lowerPName === 'id') {
        continue;
      }

      // Check if this ends with "Id" and refers to a type created in a previous step
      let isReference = false;
      if (lowerPName.endsWith('id')) {
        const baseType = lowerPName.slice(0, -2); // e.g. "lead" from "leadid"
        // If that baseType was created in a previous step, it's a reference
        for (const prevType of createdTypes) {
          if (prevType.toLowerCase() === baseType) {
            isReference = true;
            break;
          }
        }
      }

      if (isReference) {
        continue;
      }

      if (!seenParams.has(pName)) {
        seenParams.add(pName);
        const type = numberParamKeywords.has(lowerPName) ? 'number' : 'text';
        const required = !optionalParamKeywords.has(lowerPName);
        params.push({
          name: pName,
          type,
          required
        });
      }
    }

    // Add this step's created type to the list of created types
    if (step.tool === 'create' && step.type) {
      createdTypes.add(step.type);
    }
  }

  return {
    name: action.name || '',
    module: moduleName,
    purpose: purpose || 'No purpose defined',
    intents: action.intents || [],
    params,
    steps
  };
}

export function generateCompactActionIndex(skills: ParsedSkill[]): string {
  const lines: string[] = [];
  lines.push('ACTIONS (name → purpose, triggers):');
  for (const skill of skills) {
    for (const action of skill.actions) {
      const triggers = action.intents.join(', ');
      lines.push(`- ${action.name} → ${action.purpose.replace(/\.$/, '')}. Triggers: ${triggers}`);
    }
  }
  return lines.join('\n');
}
