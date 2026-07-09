/**
 * OKF (Open Knowledge Format) file storage and integration.
 * Workspace OKF files stored in Railway S3 (Tigris-backed).
 *
 * S3 structure:
 *   modules/core/{module}/SKILL.md     — core module skill files (read-only, fallback)
 *   workspaces/{scope}/index.md        — workspace root (per-workspace, editable)
 *   workspaces/{scope}/DESIGN.md       — design system tokens
 *   workspaces/{scope}/AGENTS.md       — agent rules
 *   workspaces/{scope}/skills/{mod}.md — workspace skill files (user-customizable)
 *   workspaces/{scope}/site/pages.md   — public site pages configuration
 */

import { s3Put, s3Get, s3Delete, s3List } from './s3-client';
import { CORE_MODULES } from './core-modules';
import { getCoreModuleSpecs, composeWorkspacePrompt, parseComposedWorkspace } from './module-composer';
import { validateDesignTokens, validateSkill, validateSitePages } from './schema-validator';
import { parseDesignMD } from './design-md-parser';
import { parseSkillMarkdown } from './skill-parser';

export const PRESETS: Record<string, string[]> = {
  restaurant: ['orders', 'inventory', 'bookings', 'crm', 'reports', 'expenses', 'documents'],
  salon: ['bookings', 'crm', 'orders', 'reports', 'expenses', 'documents'],
  clinic: ['bookings', 'crm', 'projects', 'support', 'reports', 'expenses', 'documents'],
  retail: ['orders', 'inventory', 'crm', 'reports', 'expenses', 'documents'],
  gym: ['bookings', 'crm', 'lms', 'hr', 'reports', 'expenses', 'documents'],
  agency: ['crm', 'projects', 'hr', 'support', 'reports', 'expenses', 'documents'],
};

// S3 keys can't contain colons — replace with hyphens
function s3Scope(scope: string): string {
  return scope.replace(/:/g, '-');
}

// ── Write ──────────────────────────────────────────────────────────

export async function uploadWorkspaceFile(
  env: any,
  scope: string,
  path: string,
  content: string
): Promise<{ s3Key: string }> {
  const s3Key = `workspaces/${s3Scope(scope)}/${path}`;
  await s3Put(env, s3Key, content);
  return { s3Key };
}

export async function uploadVerticalFile(
  env: any,
  vertical: string,
  path: string,
  content: string
): Promise<{ s3Key: string }> {
  const s3Key = `verticals/${vertical}/${path}`;
  await s3Put(env, s3Key, content);
  return { s3Key };
}

// ── Read ───────────────────────────────────────────────────────────

export async function readWorkspaceFile(env: any, scope: string, path: string): Promise<string | null> {
  return s3Get(env, `workspaces/${s3Scope(scope)}/${path}`);
}

export async function readWorkspaceIndex(env: any, scope: string): Promise<string | null> {
  return readWorkspaceFile(env, scope, 'index.md');
}

export async function readVerticalFile(env: any, vertical: string, path: string): Promise<string | null> {
  return s3Get(env, `verticals/${vertical}/${path}`);
}

export async function readVerticalIndex(env: any, vertical: string): Promise<string | null> {
  return readVerticalFile(env, vertical, 'index.md');
}

export async function readWithFallback(
  env: any,
  scope: string,
  path: string,
  vertical: string
): Promise<string | null> {
  const wsContent = await readWorkspaceFile(env, scope, path);
  if (wsContent !== null) return wsContent;

  // Extract file basename to match core module if it's under skills/
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const modName = filename.replace('.md', '');
  
  if (modName in CORE_MODULES) {
    return CORE_MODULES[modName];
  }

  return readVerticalFile(env, vertical, path);
}

// ── Delete ─────────────────────────────────────────────────────────

export async function deleteWorkspaceFile(env: any, scope: string, path: string): Promise<boolean> {
  return s3Delete(env, `workspaces/${s3Scope(scope)}/${path}`);
}

// ── List ───────────────────────────────────────────────────────────

export async function listWorkspaceModules(env: any, scope: string): Promise<string[]> {
  const keys = await s3List(env, `workspaces/${s3Scope(scope)}/skills/`);
  return keys
    .map(k => k.split('/').pop()!)
    .filter(name => name.endsWith('.md'))
    .map(name => name.replace('.md', ''));
}

export async function listVerticalModules(env: any, vertical: string): Promise<string[]> {
  // Verticals fall back to PRESETS mapping
  if (vertical in PRESETS) {
    return PRESETS[vertical];
  }
  const keys = await s3List(env, `verticals/${vertical}/`);
  return keys
    .map(k => k.split('/').pop()!)
    .filter(name => name.endsWith('.md') && name !== 'index.md')
    .map(name => name.replace('.md', ''));
}

export async function classifyVertical(
  env: any,
  description: string
): Promise<string> {
  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) return 'restaurant';

  try {
    const prompt = `You are an AI that classifies a business description into one of the supported core verticals.
Supported verticals:
- restaurant (Use for food, bakery, cafe, kitchen, bar)
- salon (Use for spa, hair, nails, beauty)
- clinic (Use for doctor, dentist, clinic, healthcare)
- retail (Use for grocery, fashion, boutique, product shops)
- gym (Use for fitness, gym, yoga, workout)
- agency (Use for office work, software, marketing, consulting)

Given this business description: "${description}"

Respond with ONLY the key of the closest matching vertical from the list above (e.g. "restaurant" or "retail"). Do not add any punctuation, intro, or explanation.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      }),
    });

    const data = await res.json() as any;
    const vertical = data?.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'restaurant';
    
    if (vertical in PRESETS) {
      return vertical;
    }
    return 'restaurant';
  } catch (err) {
    console.warn('[Classifier] Failed to classify vertical, falling back to restaurant:', err);
    return 'restaurant';
  }
}

/**
 * Initializes workspace by composing all required specs via one LLM call.
 * Uses robust schemas for validation and a self-healing fallback.
 */
export async function initWorkspaceFromVertical(
  env: any,
  scope: string,
  workspaceName: string,
  vertical: string,
  modules?: string[],
  businessDescription?: string
): Promise<void> {
  // Resolve modules
  let mods = modules?.length ? modules : PRESETS[vertical] || PRESETS.restaurant;

  const groqKey = env.GROQ_API_KEY;
  let compositionDone = false;

  if (groqKey) {
    try {
      const specs = getCoreModuleSpecs(mods);
      const prompt = composeWorkspacePrompt(
        {
          name: workspaceName,
          subdomain: scope.replace('w:', ''),
          modules: mods,
          description: businessDescription,
        },
        specs
      );

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 6000,
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const llmOutput = data?.choices?.[0]?.message?.content;
        if (llmOutput) {
          const files = parseComposedWorkspace(llmOutput);

          // Validate and write generated files
          for (const [path, content] of Object.entries(files)) {
            let isValid = true;

            if (path === 'DESIGN.md') {
              const tokens = parseDesignMD(content);
              isValid = validateDesignTokens(tokens).success;
            } else if (path === 'site/pages.md') {
              // Parse basic frontmatter for site pages validation
              const lines = content.split('\n');
              let inYaml = false;
              let yamlText = '';
              for (const line of lines) {
                if (line.trim() === '---') {
                  inYaml = !inYaml;
                  continue;
                }
                if (inYaml) yamlText += line + '\n';
              }
              // Basic check
              isValid = yamlText.includes('pages:');
            } else if (path.startsWith('skills/')) {
              const parsed = parseSkillMarkdown(content);
              isValid = validateSkill(parsed).success;
            }

            if (isValid) {
              await uploadWorkspaceFile(env, scope, path, content);
            } else {
              console.warn(`[composer] Spec validation failed for ${path}, writing default fallback.`);
            }
          }
          compositionDone = true;
        }
      }
    } catch (err) {
      console.warn('[composer] Composed initialization failed, running fallback:', err);
    }
  }

  // Self-healing fallback if LLM or validation failed
  if (!compositionDone) {
    console.warn('[composer] Using standard template fallback.');
    
    // 1. DESIGN.md default
    const defaultDesign = `---
name: ${workspaceName}
version: 1.0.0
colors:
  primary: "#1B4332"
  secondary: "#2D6A4F"
  tertiary: "#D4A373"
  neutral: "#FEFAE0"
  on-primary: "#FFFFFF"
typography:
  h1: { fontFamily: "Inter", fontSize: "1.75rem", fontWeight: 700 }
  body-md: { fontFamily: "Inter", fontSize: "0.938rem", fontWeight: 400 }
rounded: { sm: "6px", md: "12px", lg: "16px" }
spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
components:
  action-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---
`;
    await uploadWorkspaceFile(env, scope, 'DESIGN.md', defaultDesign);

    // 2. AGENTS.md default
    const defaultAgents = `---
name: ${workspaceName} Agent
role: Assistant
constraints:
  - Be helpful and polite.
---
`;
    await uploadWorkspaceFile(env, scope, 'AGENTS.md', defaultAgents);

    // 3. site/pages.md default
    const defaultPages = `---
pages:
  - slug: /catalog
    template: catalog-grid
    data_source: "matter WHERE type = 'product'"
    module: inventory
---
`;
    await uploadWorkspaceFile(env, scope, 'site/pages.md', defaultPages);

    // 4. Copy unpersonalized core modules as fallback
    for (const mod of mods) {
      if (mod in CORE_MODULES) {
        await uploadWorkspaceFile(env, scope, `skills/${mod}.md`, CORE_MODULES[mod]);
      }
    }
  }

  // 5. Always write index.md listing all modules
  const moduleLinks = mods.map(m => `- [${m}](./skills/${m}.md)`).join('\n');
  const rootIndex = `# ${workspaceName}\n\n**Vertical:** ${vertical}\n**Modules:** ${mods.join(', ')}\n\n## Modules\n${moduleLinks}\n`;
  await uploadWorkspaceFile(env, scope, 'index.md', rootIndex);
}
