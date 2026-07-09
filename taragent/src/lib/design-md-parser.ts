export interface DesignTokens {
  name: string;
  version: string;
  colors: Record<string, string>;
  typography: Record<string, { fontFamily: string; fontSize: string; fontWeight: number }>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  components: Record<string, Record<string, string>>;
}

export function parseDesignMD(markdown: string): DesignTokens {
  const lines = markdown.split(/\r?\n/);
  let inYaml = false;
  const yamlLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      if (!inYaml && yamlLines.length === 0 && i === 0) {
        inYaml = true;
      } else {
        inYaml = false;
        break; // Finished parsing frontmatter
      }
      continue;
    }
    if (inYaml) {
      yamlLines.push(line);
    }
  }

  // Basic YAML Parser for Design Tokens (Indentation & Nesting aware)
  const raw: Record<string, any> = {};
  const path: { key: string; indent: number }[] = [];

  for (const line of yamlLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    // Pop path elements until we find the parent (which has less indentation)
    while (path.length > 0 && path[path.length - 1].indent >= indent) {
      path.pop();
    }

    // Resolve where to insert the value
    let parent = raw;
    for (const p of path) {
      if (!parent[p.key]) {
        parent[p.key] = {};
      }
      parent = parent[p.key];
    }

    if (val === '') {
      parent[key] = {};
      path.push({ key, indent });
    } else {
      if (val.startsWith('{') && val.endsWith('}')) {
        parent[key] = parseBraceObject(val);
      } else {
        parent[key] = stripQuotes(val);
      }
    }
  }

  // Substitute values (e.g. "{colors.primary}" with colors.primary)
  const tokens: DesignTokens = {
    name: raw.name || 'Default Workspace',
    version: raw.version || '1.0.0',
    colors: raw.colors || {},
    typography: raw.typography || {},
    rounded: raw.rounded || {},
    spacing: raw.spacing || {},
    components: raw.components || {},
  };

  // Helper to resolve reference
  function resolveRef(val: string): string {
    if (typeof val !== 'string') return val;
    const match = val.match(/^\{([a-zA-Z0-9_.-]+)\}$/);
    if (!match) return val;
    const path = match[1].split('.');
    let current: any = tokens;
    for (const part of path) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return val;
      }
    }
    return typeof current === 'string' ? current : val;
  }

  // Resolve component token references
  for (const componentKey of Object.keys(tokens.components)) {
    const comp = tokens.components[componentKey];
    for (const propKey of Object.keys(comp)) {
      comp[propKey] = resolveRef(comp[propKey]);
    }
  }

  return tokens;
}

function stripQuotes(str: string): string {
  const trimmed = str.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseBraceObject(str: string): Record<string, any> {
  // e.g. { fontFamily: "Inter", fontSize: "1.75rem", fontWeight: 700 }
  const inner = str.slice(1, -1).trim();
  const result: Record<string, any> = {};
  
  // Split by comma outside quotes
  const parts: string[] = [];
  let current = '';
  let inQuotes: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (inQuotes) {
      if (char === inQuotes) inQuotes = null;
      current += char;
    } else if (char === "'" || char === '"') {
      inQuotes = char;
      current += char;
    } else if (char === ',') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim();
    const val = stripQuotes(part.slice(colonIdx + 1));
    const num = Number(val);
    result[key] = isNaN(num) ? val : num;
  }
  
  return result;
}
