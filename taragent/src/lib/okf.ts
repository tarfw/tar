/**
 * OKF (Open Knowledge Format) file storage and integration.
 * Workspace OKF files stored in Railway S3 (Tigris-backed).
 *
 * S3 structure:
 *   workspaces/{scope}/index.md        — workspace root (per-workspace, editable)
 *   workspaces/{scope}/skills/{mod}.md — workspace skill files (AI-generated)
 *   workspaces/{scope}/site/           — brand.md, design.md, layouts/
 */

import { s3Put, s3Get, s3Delete, s3List } from './s3-client';
import { CORE_MODULES } from './core-modules';
import { getCoreModuleSpecs, composeWorkspacePrompt, parseComposedWorkspace } from './module-composer';
import { validateDesignTokens, validateSkill } from './schema-validator';
import { parseDesignMD } from './design-md-parser';
import { parseSkillMarkdown } from './skill-parser';

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

// ── Read ───────────────────────────────────────────────────────────

export async function readWorkspaceFile(env: any, scope: string, path: string): Promise<string | null> {
  return s3Get(env, `workspaces/${s3Scope(scope)}/${path}`);
}

export async function readWorkspaceIndex(env: any, scope: string): Promise<string | null> {
  return readWorkspaceFile(env, scope, 'index.md');
}

export async function readWithFallback(
  env: any,
  scope: string,
  path: string
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

  return null;
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

/**
 * Initializes workspace by composing all required specs via one LLM call.
 * AI picks modules based on business description, generates SKILL.md files.
 */
export async function initWorkspace(
  env: any,
  scope: string,
  workspaceName: string,
  modules: string[],
  businessDescription?: string
): Promise<void> {
  const groqKey = env.GROQ_API_KEY;
  let compositionDone = false;

  if (groqKey) {
    try {
      const specs = getCoreModuleSpecs(modules);
      const prompt = composeWorkspacePrompt(
        {
          name: workspaceName,
          subdomain: scope.replace('w:', ''),
          modules,
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
    console.warn('[composer] Using default fallback.');
    
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

    // 2. Copy core modules as fallback
    for (const mod of modules) {
      if (mod in CORE_MODULES) {
        await uploadWorkspaceFile(env, scope, `skills/${mod}.md`, CORE_MODULES[mod]);
      }
    }
  }

  // 3. Always write index.md listing all modules
  const moduleLinks = modules.map(m => `- [${m}](./skills/${m}.md)`).join('\n');
  const rootIndex = `# ${workspaceName}\n\n**Modules:** ${modules.join(', ')}\n\n## Modules\n${moduleLinks}\n`;
  await uploadWorkspaceFile(env, scope, 'index.md', rootIndex);
}
