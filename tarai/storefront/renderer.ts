/**
 * Storefront renderer — combines template + sections + theme → HTML.
 *
 * Template defines the page wrapper (head, styles, body).
 * Sections are rendered and injected into the template.
 * Theme values replace {{variables}} in the template.
 */

import type { StorefrontLayout } from '../src/lib/storefront-schema';
import { SECTION_RENDERERS } from './sections';

const TEMPLATE_DIR = './templates';

const DEFAULT_TEMPLATES: Record<string, string> = {};

async function loadTemplate(name: string): Promise<string> {
  if (DEFAULT_TEMPLATES[name]) return DEFAULT_TEMPLATES[name];

  // In production (CF Worker), templates are bundled.
  // For now, return a minimal fallback.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --primary: {{primary}};
      --bg: {{background}};
      --text: {{text}};
      --font: {{font}};
      --fontHeading: {{fontHeading}};
    }
    body { font-family: var(--font), sans-serif; background: var(--bg); color: var(--text); margin: 0; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <!-- SECTIONS -->
</body>
</html>`;
}

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function renderSections(sections: StorefrontLayout['sections']): string {
  return sections
    .map((section) => {
      const renderer = SECTION_RENDERERS[section.type];
      if (!renderer) return `<!-- unknown section: ${section.type} -->`;
      return renderer(section.config || {});
    })
    .join('\n');
}

/**
 * Render a complete HTML page from a StorefrontLayout.
 */
export async function renderStorefront(layout: StorefrontLayout, storeName: string): Promise<string> {
  const template = await loadTemplate(layout.template);

  const sectionsHtml = renderSections(layout.sections);

  let html = template.replace('<!-- SECTIONS -->', sectionsHtml);

  html = replaceVars(html, {
    name: storeName,
    primary: layout.theme.primary,
    background: layout.theme.background,
    text: layout.theme.text,
    font: layout.theme.font,
    fontHeading: layout.theme.fontHeading,
  });

  return html;
}
