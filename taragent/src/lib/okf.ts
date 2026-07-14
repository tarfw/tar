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
import type { ExtractedBusiness } from './extract-business';

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

// ── OKF Folder Scaffolder ───────────────────────────────────────────
// Creates the full OKF folder structure + index.md per folder

export async function scaffoldOkfFolders(
  env: any,
  scope: string,
  workspaceName: string,
  modules: string[]
): Promise<void> {
  const folders = ['business', 'products', 'policies', 'faqs', 'team', 'skills', 'site'];

  // Root index.md
  const moduleLinks = modules.map(m => `- [${m}](./skills/${m}.md)`).join('\n');
  const rootIndex = `# ${workspaceName}\n\n**Modules:** ${modules.join(', ')}\n\n## Folders\n${folders.map(f => `- [${f}](./${f}/index.md)`).join('\n')}\n`;
  await uploadWorkspaceFile(env, scope, 'index.md', rootIndex);

  // Folder index.md files
  for (const folder of folders) {
    const folderIndex = `# ${folder.charAt(0).toUpperCase() + folder.slice(1)}\n`;
    await uploadWorkspaceFile(env, scope, `${folder}/index.md`, folderIndex);
  }

  // Site layouts folder placeholder
  await uploadWorkspaceFile(env, scope, 'site/layouts/.gitkeep', '');
}

// ── OKF Content Generator ───────────────────────────────────────────
// Generates profile.md, catalog.md, members.md, brand.md, design.md, home.json from extracted business data

export async function generateOkfContent(
  env: any,
  scope: string,
  business: ExtractedBusiness,
  modules: string[],
  userId: string
): Promise<void> {
  const wsName = business.name;

  // business/profile.md
  const profileMd = `# Business Profile

| Field | Value |
|-------|-------|
| Name | ${wsName} |
| Type | ${business.type} |
| Location | ${business.location || 'Not specified'} |
| Hours | ${business.hours || 'Not specified'} |
| Description | ${business.description || 'Not specified'} |
`;
  await uploadWorkspaceFile(env, scope, 'business/profile.md', profileMd);

  // products/catalog.md
  const allItems = [...business.products, ...business.services];
  if (allItems.length > 0) {
    const rows = allItems.map(item =>
      `| ${item.name} | ₹${item.price || 0} | ${item.description || ''} |`
    ).join('\n');
    const catalogMd = `# Products & Services\n\n| Item | Price | Description |\n|------|-------|-------------|\n${rows}\n`;
    await uploadWorkspaceFile(env, scope, 'products/catalog.md', catalogMd);
  }

  // policies/return.md
  if (business.policies.return) {
    await uploadWorkspaceFile(env, scope, 'policies/return.md', `# Return Policy\n\n${business.policies.return}\n`);
  }

  // policies/delivery.md
  if (business.policies.delivery) {
    await uploadWorkspaceFile(env, scope, 'policies/delivery.md', `# Delivery Policy\n\n${business.policies.delivery}\n`);
  }

  // faqs/common.md
  if (business.faqs.length > 0) {
    const faqMd = `# FAQs\n\n${business.faqs.map(f => `## ${f.q}\n${f.a}`).join('\n\n')}\n`;
    await uploadWorkspaceFile(env, scope, 'faqs/common.md', faqMd);
  }

  // team/members.md
  const membersMd = `# Team Members\n\n| Name | Role | User ID |\n|------|------|---------|\n| ${wsName} Owner | owner | ${userId} |\n`;
  await uploadWorkspaceFile(env, scope, 'team/members.md', membersMd);

  // site/brand.md
  const primaryColor = business.brand_color || '#1B4332';
  const headingFont = business.typography.heading || 'Inter';
  const bodyFont = business.typography.body || 'Inter';
  const brandMd = `---
colors:
  primary: "${primaryColor}"
  secondary: "#1B2A33"
fonts:
  heading: ${headingFont}
  body: ${bodyFont}
---\n`;
  await uploadWorkspaceFile(env, scope, 'site/brand.md', brandMd);

  // site/design.md
  const designMd = `---
name: ${wsName}
version: 1.0.0
colors:
  primary: "${primaryColor}"
  secondary: "#1B2A33"
  tertiary: "#D4A373"
  neutral: "#FEFAE0"
  on-primary: "#FFFFFF"
typography:
  h1: { fontFamily: "${headingFont}", fontSize: "1.75rem", fontWeight: 700 }
  body: { fontFamily: "${bodyFont}", fontSize: "0.938rem", fontWeight: 400 }
rounded: { sm: "6px", md: "12px", lg: "16px" }
spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
components:
  action-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---\n`;
  await uploadWorkspaceFile(env, scope, 'site/design.md', designMd);

  // site/layouts/home.json — auto-generate from business data
  const menuItems = business.products.map(p => ({ name: p.name, price: `₹${p.price}` }));
  const serviceItems = business.services.map(s => ({ name: s.name, price: `₹${s.price}` }));
  const allMenuItems = [...menuItems, ...serviceItems];

  const homeJson: any = {
    workspaceId: scope.replace('w:', ''),
    target: 'web',
    revision: 'v1',
    routes: [{
      path: '/',
      nodes: [
        {
          id: 'hero',
          type: 'hero_banner',
          layout: 'centered',
          props: {
            title: wsName,
            subtitle: business.description || `${business.type} in ${business.location}`,
          },
        },
      ],
    }],
  };

  // Add about section if description or hours exist
  if (business.description || business.hours) {
    const aboutChildren: any[] = [];
    if (business.description) {
      aboutChildren.push({
        id: 'about-text',
        type: 'text_block',
        layout: 'text-only',
        props: { heading: 'About Us', body: business.description },
      });
    }
    if (business.hours) {
      aboutChildren.push({
        id: 'about-hours',
        type: 'text_block',
        layout: 'text-only',
        props: { heading: 'Hours', body: business.hours },
      });
    }
    homeJson.routes[0].nodes.push({
      id: 'about',
      type: 'content_grid',
      layout: aboutChildren.length > 1 ? '2-col' : '1-col',
      children: aboutChildren,
    });
  }

  // Add product/service grid if items exist
  if (allMenuItems.length > 0) {
    homeJson.routes[0].nodes.push({
      id: 'menu',
      type: 'product_grid',
      layout: allMenuItems.length <= 2 ? '2-col' : '3-col',
      props: { items: allMenuItems, columns: Math.min(allMenuItems.length, 3) },
    });
  }

  // Add FAQ section if FAQs exist
  if (business.faqs.length > 0) {
    homeJson.routes[0].nodes.push({
      id: 'faq',
      type: 'faq_accordion',
      layout: 'single-column',
      props: { items: business.faqs },
    });
  }

  // Add contact form
  homeJson.routes[0].nodes.push({
    id: 'contact',
    type: 'contact_form',
    layout: 'centered',
    props: { fields: ['name', 'phone', 'message'], submit_label: 'Send' },
  });

  // Add footer
  homeJson.routes[0].nodes.push({
    id: 'footer',
    type: 'footer',
    layout: 'multi-column',
    props: { links: ['/'], social: [] },
  });

  await uploadWorkspaceFile(env, scope, 'site/layouts/home.json', JSON.stringify(homeJson, null, 2));
}
