/**
 * md-section-parser.ts
 *
 * Method B — Section HTML/CSS Extractor
 *
 * Reads the "## Universal Section Specs" body from a DESIGN-*.md file.
 * For each "### section_XX_<name>" block, extracts:
 *   - html: the HTML contract string
 *   - css:  the CSS rules string
 *
 * Then `renderFromSpec(sectionType, props, html, css)` fills in
 * {{mustache}} placeholders with live node.props data.
 */

export interface SectionSpec {
  html: string;
  css: string;
}

/**
 * Parses the markdown body (below the --- frontmatter) and returns
 * a map of section key → { html, css }.
 *
 * Section keys are normalised:
 *   "### section_02_hero_banner"  →  "hero_banner"  AND  "hero"
 */
export function parseSectionSpecs(markdownContent: string): Record<string, SectionSpec> {
  const specs: Record<string, SectionSpec> = {};

  // Find the body after the closing --- of frontmatter
  const fmEnd = markdownContent.indexOf('\n---\n', 1);
  const body = fmEnd !== -1 ? markdownContent.slice(fmEnd + 5) : markdownContent;

  // Split on ### headings
  const blocks = body.split(/^### /m).slice(1); // first item is empty

  for (const block of blocks) {
    const lines = block.split('\n');
    const heading = lines[0].trim(); // e.g. "section_02_hero_banner"

    // Derive lookup keys:
    //   "section_02_hero_banner" → ["hero_banner", "hero", "hero banner"]
    const raw = heading.replace(/^section_\d+_/, '').toLowerCase();
    const keys = Array.from(new Set([
      raw,
      raw.replace(/_/g, ' '),
      raw.split('_')[0], // first word e.g. "hero"
    ]));

    const rest = lines.slice(1).join('\n');

    const html = extractCodeBlock(rest, 'html');
    const css = extractCodeBlock(rest, 'css');

    const spec: SectionSpec = { html, css };
    for (const key of keys) {
      if (key) specs[key] = spec;
    }
  }

  return specs;
}

/**
 * Dedents a multiline string by removing the minimum leading whitespace
 * that is common to all non-empty lines.
 */
function dedent(text: string): string {
  const lines = text.split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return text;
  const minIndent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)?.[1].length ?? 0));
  if (minIndent === 0) return text;
  return lines.map(l => l.slice(minIndent)).join('\n');
}

/**
 * Extracts the content of a fenced code block with the given language tag.
 * Handles code fences that may be indented (e.g. inside bullet lists).
 */
function extractCodeBlock(text: string, lang: string): string {
  // Allow any leading whitespace before the fence markers
  const regex = new RegExp('[ \\t]*```' + lang + '[^\\n]*\\n([\\s\\S]*?)\\n[ \\t]*```', 'i');
  const match = text.match(regex);
  if (!match) return '';
  return dedent(match[1]).trim();
}

/**
 * Fills {{placeholder}} tokens in an HTML template string with values
 * from a props object. Falls back to '' for missing keys.
 * Values are NOT HTML-escaped so URLs, image paths, and HTML snippets
 * pass through as-is. Callers are responsible for safe content.
 */
export function interpolate(template: string, props: Record<string, any>): string {
  let result = template;

  // 1. Process {{#each arrayKey}} ... {{/each}} blocks
  result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, arrayKey, block) => {
    const list = props[arrayKey];
    if (!Array.isArray(list) || list.length === 0) return '';
    return list.map((item: any, idx: number) => {
      const itemProps = typeof item === 'object' && item !== null ? item : { item };
      // Fallback defaults for product items
      const mergedProps = {
        image: itemProps.image || itemProps.imageUrl || 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=600&q=80',
        hoverImage: itemProps.hoverImage || itemProps.image || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
        name: itemProps.name || itemProps.title || 'Performance Gear',
        subtitle: itemProps.subtitle || itemProps.description || 'Nulu™ Fabric',
        price: itemProps.price || '88',
        ...itemProps
      };
      return interpolate(block, mergedProps);
    }).join('');
  });

  // 2. Process {{#if key}} ... {{/if}} blocks
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) => {
    const val = props[key];
    if (val && (Array.isArray(val) ? val.length > 0 : true)) {
      return interpolate(block, props);
    }
    return '';
  });

  // 3. Process standard {{variable}} replacement
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = props[key];
    if (val == null) return '';
    return String(val);
  });

  // 4. Strip any remaining unresolved block tags if present
  result = result.replace(/\{\{\/?#?\w+[^}]*\}\}/g, '');

  return result;
}

/**
 * Renders a section from a spec + live props.
 * Returns { html, css } ready to inject into the page.
 */
export function renderFromSpec(
  sectionType: string,
  props: Record<string, any>,
  specs: Record<string, SectionSpec>
): { html: string; css: string } | null {
  // Try exact match, then first-word fallback
  const key = sectionType.toLowerCase().replace(/_/g, ' ');
  const spec = specs[sectionType.toLowerCase()] ||
               specs[key] ||
               specs[sectionType.split('_')[0].toLowerCase()];

  if (!spec || !spec.html) return null;

  return {
    html: interpolate(spec.html, props),
    css: spec.css,
  };
}
