/**
 * OKF (Open Knowledge Format) file storage and integration.
 * Workspace OKF files stored in Railway S3 (Tigris-backed).
 *
 * S3 structure:
 *   verticals/{name}/index.md          — vertical template (global, read-only)
 *   verticals/{name}/{module}.md       — vertical skill files
 *   workspaces/{scope}/index.md        — workspace root (per-workspace, editable)
 *   workspaces/{scope}/{module}.md     — workspace skill files (user-customizable)
 */

import { s3Put, s3Get, s3Delete, s3List } from './s3-client';

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
  return readVerticalFile(env, vertical, path);
}

// ── Delete ─────────────────────────────────────────────────────────

export async function deleteWorkspaceFile(env: any, scope: string, path: string): Promise<boolean> {
  return s3Delete(env, `workspaces/${s3Scope(scope)}/${path}`);
}

// ── List ───────────────────────────────────────────────────────────

export async function listWorkspaceModules(env: any, scope: string): Promise<string[]> {
  const keys = await s3List(env, `workspaces/${s3Scope(scope)}/`);
  return keys
    .map(k => k.split('/').pop()!)
    .filter(name => name.endsWith('.md') && name !== 'index.md')
    .map(name => name.replace('.md', ''));
}

export async function listVerticalModules(env: any, vertical: string): Promise<string[]> {
  const keys = await s3List(env, `verticals/${vertical}/`);
  return keys
    .map(k => k.split('/').pop()!)
    .filter(name => name.endsWith('.md') && name !== 'index.md')
    .map(name => name.replace('.md', ''));
}

async function personalizeModuleTemplate(
  env: any,
  moduleContent: string,
  businessName: string,
  businessType: string
): Promise<string> {
  const groqKey = env.GROQ_API_KEY;
  if (!groqKey) return moduleContent;

  try {
    const prompt = `You are an AI that personalizes OKF (Open Knowledge Format) markdown skill files for businesses.
Given this template skill markdown:
---
${moduleContent}
---

Personalize it for this business:
Name: ${businessName}
Type: ${businessType}

Rules:
1. Preserve all markdown structure, YAML frontmatter, action steps (like read/create/update), and tool calls exactly. Do not break syntax.
2. In the headings, text, and descriptions, replace placeholders or generic business terms with "${businessName}" or specific details relevant to a ${businessType}.
3. Return ONLY the personalized markdown content. Do not add any conversational chat wrappers.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    const data = await res.json() as any;
    const personalized = data?.choices?.[0]?.message?.content || moduleContent;
    return personalized.trim();
  } catch (err) {
    console.warn('[Personalizer] Failed to personalize module template:', err);
    return moduleContent;
  }
}

export async function initWorkspaceFromVertical(
  env: any,
  scope: string,
  workspaceName: string,
  vertical: string,
  modules?: string[]
): Promise<void> {
  // Auto-detect modules from vertical template if not provided
  const mods = modules?.length ? modules : await listVerticalModules(env, vertical);

  // 1. Create workspace index.md
  const moduleLinks = mods.map(m => `- [${m}](./${m}.md)`).join('\n');
  const rootIndex = `# ${workspaceName}\n\n**Vertical:** ${vertical}\n**Modules:** ${mods.join(', ')}\n\n## Modules\n${moduleLinks}\n`;
  await uploadWorkspaceFile(env, scope, 'index.md', rootIndex);

  // 2. Copy each module from vertical template to workspace (with personalization)
  for (const mod of mods) {
    let content = await readVerticalFile(env, vertical, `${mod}.md`);
    if (content) {
      try {
        content = await personalizeModuleTemplate(env, content, workspaceName, vertical);
      } catch (err) {
        console.warn(`[okf] Failed to personalize template for ${mod}:`, err);
      }
      await uploadWorkspaceFile(env, scope, `${mod}.md`, content);
    }
  }
}
