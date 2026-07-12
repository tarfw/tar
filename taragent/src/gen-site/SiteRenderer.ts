/**
 * SiteRenderer — replaces site-renderer.ts switches.
 * Uses SiteRegistry for dynamic HTML rendering.
 */

import { getSiteComponent, hasSiteComponent } from './registry/SiteRegistry';
import './registry/builtins'; // Register all built-ins
import type { UINode, SiteLayout } from '../gen-ui/types';

interface RenderOptions {
  plan: SiteLayout;
  designTokens: {
    colors: Record<string, string>;
    rounded: Record<string, string>;
    spacing: Record<string, string>;
    typography: Record<string, any>;
  };
  data?: Record<string, any[]>;
  workspaceName?: string;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNodeToHtml(
  node: UINode,
  designTokens: RenderOptions['designTokens'],
  data?: Record<string, any[]>
): string {
  // Unknown type = silent skip, never crash
  if (!hasSiteComponent(node.type)) {
    console.warn(`[SiteRenderer] Unknown component type: ${node.type}`);
    return '';
  }

  const entry = getSiteComponent(node.type);
  if (!entry) return '';

  // Resolve bindings to data
  const resolvedData: any[] = [];
  if (node.bindings) {
    for (const [key, binding] of Object.entries(node.bindings)) {
      const resourceData = data?.[binding.resource] || [];
      if (Array.isArray(resourceData)) {
        resolvedData.push(...resourceData);
      }
    }
  }

  return entry.renderer({
    type: node.type,
    props: node.props,
    designTokens,
    data: resolvedData,
  });
}

export function renderSiteToHtml(options: RenderOptions): string {
  const { plan, designTokens, data = {}, workspaceName } = options;
  const { colors, spacing } = designTokens;

  // Find the first route
  const route = plan.routes[0];
  if (!route) {
    return `<!DOCTYPE html><html><body><p>No layout available</p></body></html>`;
  }

  // Render all nodes
  const contentHtml = route.nodes
    .map((node) => renderNodeToHtml(node, designTokens, data))
    .filter((html) => html.length > 0)
    .join('\n');

  // Generate CSS from design tokens
  const styles = `
    :root {
      --primary: ${colors.primary || '#1B4332'};
      --secondary: ${colors.secondary || '#2D6A4F'};
      --tertiary: ${colors.tertiary || '#D4A373'};
      --neutral: ${colors.neutral || '#FEFAE0'};
      --on-primary: ${colors['on-primary'] || '#FFFFFF'};
      --rounded-sm: ${designTokens.rounded.sm || '6px'};
      --rounded-md: ${designTokens.rounded.md || '12px'};
      --rounded-lg: ${designTokens.rounded.lg || '16px'};
      --spacing-xs: ${spacing.xs || '4px'};
      --spacing-sm: ${spacing.sm || '8px'};
      --spacing-md: ${spacing.md || '16px'};
      --spacing-lg: ${spacing.lg || '24px'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--neutral);
      color: var(--primary);
      font-family: "${designTokens.typography?.['body-md']?.fontFamily || 'Inter'}", sans-serif;
      line-height: 1.5;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "${designTokens.typography?.h1?.fontFamily || 'Outfit'}", sans-serif;
      font-weight: 700;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: var(--spacing-lg); }
    .btn {
      background: var(--tertiary);
      color: var(--on-primary);
      border: none;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--rounded-sm);
      cursor: pointer;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .grid { display: grid; gap: var(--spacing-lg); margin-top: var(--spacing-lg); }
    .card {
      background: white;
      border-radius: var(--rounded-md);
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.05);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
    }
    .card-body { padding: var(--spacing-md); display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between; }
    .card-title { font-size: 1.2rem; margin-bottom: var(--spacing-xs); }
    .card-price { font-weight: 700; color: var(--tertiary); font-size: 1.1rem; margin-bottom: var(--spacing-sm); }
    .footer { text-align: center; padding: var(--spacing-lg); font-size: 0.85rem; color: rgba(0,0,0,0.5); margin-top: 80px; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(workspaceName || 'Workspace')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  <header style="display:flex;justify-content:space-between;align-items:center;padding:var(--spacing-md) var(--spacing-lg);border-bottom:1px solid rgba(0,0,0,0.05);">
    <a href="/" style="font-size:1.5rem;font-weight:700;color:var(--primary);text-decoration:none;">
      ${escapeHtml(workspaceName || 'Workspace')}
    </a>
  </header>
  
  <main>${contentHtml}</main>
  
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(workspaceName || 'Workspace')}. Powered by tar.</p>
  </footer>
</body>
</html>`;
}
