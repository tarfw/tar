/**
 * Web SiteRegistry — Map<type, render function> for HTML output.
 * One registry per target (web).
 */

// ── Types ───────────────────────────────────────────────────────────

export interface SiteSectionProps {
  type: string;
  props: Record<string, any>;
  designTokens: {
    colors: Record<string, string>;
    rounded: Record<string, string>;
    spacing: Record<string, string>;
    typography: Record<string, any>;
  };
  data?: any[];
}

export type SiteRenderer = (props: SiteSectionProps) => string;

export interface SiteComponentEntry {
  renderer: SiteRenderer;
  label: string;
  description: string;
}

// ── Registry ────────────────────────────────────────────────────────

const registry = new Map<string, SiteComponentEntry>();

export function registerSiteComponent(type: string, entry: SiteComponentEntry): void {
  registry.set(type, entry);
}

export function getSiteComponent(type: string): SiteComponentEntry | undefined {
  return registry.get(type);
}

export function hasSiteComponent(type: string): boolean {
  return registry.has(type);
}

export function getAllSiteComponents(): SiteComponentEntry[] {
  return Array.from(registry.values());
}
