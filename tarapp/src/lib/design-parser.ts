/**
 * Level 3 Section Structural Contract Parser
 * Extracts Design Tokens, Typography Scales, Component Rules, and Section Structural Contracts
 * from OKF .md files (e.g. DESIGN-notion.md, DESIGN-drinkpouch.md).
 */

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, any>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  components: Record<string, any>;
  sectionSpecs: Record<string, any>;
}

export function parseDesignMarkdown(markdownContent: string): DesignTokens {
  const colors: Record<string, string> = {};
  const typography: Record<string, any> = {};
  const rounded: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const components: Record<string, any> = {};
  const sectionSpecs: Record<string, any> = {};

  // Simple YAML / Markdown Section Extractor
  const colorMatches = markdownContent.match(/colors:([\s\S]*?)(?=\n[a-z]+:|\n---|\n#)/i);
  if (colorMatches) {
    const lines = colorMatches[1].split('\n');
    for (const line of lines) {
      const match = line.match(/\s*([a-z0-9-]+):\s*["']?([^"'\n]+)["']?/i);
      if (match) {
        colors[match[1]] = match[2].trim();
      }
    }
  }

  const roundedMatches = markdownContent.match(/rounded:([\s\S]*?)(?=\n[a-z]+:|\n---|\n#)/i);
  if (roundedMatches) {
    const lines = roundedMatches[1].split('\n');
    for (const line of lines) {
      const match = line.match(/\s*([a-z0-9-]+):\s*["']?([^"'\n]+)["']?/i);
      if (match) {
        rounded[match[1]] = match[2].trim();
      }
    }
  }

  const spacingMatches = markdownContent.match(/spacing:([\s\S]*?)(?=\n[a-z]+:|\n---|\n#)/i);
  if (spacingMatches) {
    const lines = spacingMatches[1].split('\n');
    for (const line of lines) {
      const match = line.match(/\s*([a-z0-9-]+):\s*["']?([^"'\n]+)["']?/i);
      if (match) {
        spacing[match[1]] = match[2].trim();
      }
    }
  }

  return {
    colors,
    typography,
    rounded,
    spacing,
    components,
    sectionSpecs,
  };
}
