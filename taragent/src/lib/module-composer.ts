import { CORE_MODULES } from './core-modules';

export interface WorkspaceComposerInput {
  name: string;
  subdomain: string;
  modules: string[];
  location?: string;
  description?: string;
}

export interface ComposedFiles {
  files: Record<string, string>; // path -> content
}

/**
 * Resolves the raw SKILL.md contents for the selected modules.
 */
export function getCoreModuleSpecs(modules: string[]): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const mod of modules) {
    if (mod in CORE_MODULES) {
      specs[mod] = CORE_MODULES[mod];
    }
  }
  return specs;
}

/**
 * Composes the prompt for the LLM to personalize and generate the workspace files.
 */
export function composeWorkspacePrompt(
  input: WorkspaceComposerInput,
  specs: Record<string, string>
): string {
  const specDetails = Object.entries(specs)
    .map(([mod, content]) => `=== MODULE: ${mod} ===\n${content}\n`)
    .join('\n');

  return `You are the core AI workspace composer for TAR.
Your task is to take the business information and selected modules below, and compose a personalized workspace folder of files.

Business Details:
- Name: "${input.name}"
- Subdomain: "${input.subdomain}"
- Location: "${input.location || 'Not Specified'}"
- Description/Type: "${input.description || 'General Business'}"
- Selected Modules: ${input.modules.join(', ')}

Available Module Templates:
${specDetails}

You MUST generate the following files:
1. "DESIGN.md" - Customized theme tokens. Follow this EXACT YAML structure:
---
name: ${input.name}
version: 1.0.0
colors:
  primary: "<vibrant color matched to business, e.g. #1B4332>"
  secondary: "<matching secondary, e.g. #2D6A4F>"
  tertiary: "<accent color, e.g. #D4A373>"
  neutral: "<light bg color, e.g. #FEFAE0>"
  on-primary: "#FFFFFF"
typography:
  h1: { fontFamily: "Outfit", fontSize: "1.75rem", fontWeight: 700 }
  body-md: { fontFamily: "Inter", fontSize: "0.938rem", fontWeight: 400 }
rounded: { sm: "6px", md: "12px", lg: "16px" }
spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px" }
components:
  action-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---

2. "AGENTS.md" - Agent behavior rules, e.g.:
---
name: ${input.name} Agent
role: Customer Assistant
constraints:
  - Be helpful and concise.
  - Follow local regulations in ${input.location || 'our area'}.
---

3. "site/pages.md" - Combined site pages contributed by the active modules. Use this EXACT format:
---
pages:
  <For each site_page listed in the templates' YAML frontmatter, customize and add it here, e.g.:>
  - slug: /menu
    template: catalog-grid
    data_source: "matter WHERE type = 'product'"
    module: orders
---

4. "skills/<module>.md" (One file per selected module) - Event UI layout & agent persona spec for this business vertical.
   - Specify the YAML frontmatter with type: skill, name: <module>, and app_layout.sections (quick-actions, metric-cards, status-board, data-grid).
   - Core event actions (like sale, booking, adjust, expense) are built into the platform natively. Only define custom ### action_... step definitions if this business requires specialized custom events beyond standard built-in events.
   - Include clear persona guidelines in the prose body for handling customer inquiries in this business vertical.

OUTPUT FORMAT RULES:
Wrap each file in <file path="[filename]">[content]</file> tags.
Do NOT output any markdown backticks, explanations, or chats outside the tags.

Example Output:
<file path="DESIGN.md">
---
...
---
</file>
<file path="skills/transactions.md">
---
type: skill
name: transactions
version: 1.0.0
app_layout:
  primary_action: action_record_sale
  layout: dashboard
  sections:
    - type: quick-actions
      actions: [action_record_sale, action_refund_order, action_void_order]
    - type: metric-card
      title: "Daily Sales"
      data: "SELECT SUM(value) FROM matter WHERE type='order' AND status='active'"
    - type: data-grid
      title: "Transactions Feed"
      props: { type: "order", mode: "table" }
---
# Transactions Event Spec
Handles sales, POS checkout, and transaction logs.
</file>
`;
}

/**
 * Parses the XML-like output from the LLM back into a file dictionary.
 */
export function parseComposedWorkspace(llmOutput: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  // Regex to extract path and content inside <file path="...">...</file>
  const fileRegex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;
  
  while ((match = fileRegex.exec(llmOutput)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2].trim();
    files[filePath] = fileContent;
  }
  
  return files;
}
