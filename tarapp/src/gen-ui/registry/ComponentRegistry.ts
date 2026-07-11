/**
 * Native ComponentRegistry — Map<type, component> for React Native.
 * One registry per target (native).
 */

import { type ComponentType } from 'react';

// ── Types ───────────────────────────────────────────────────────────

export interface SectionProps {
  type: string;
  props: Record<string, any>;
  designTokens: {
    colors: Record<string, string>;
    rounded: Record<string, number>;
    spacing: Record<string, number>;
    typography: Record<string, any>;
  };
  data?: any[];
  onExecuteAction?: (actionName: string, params: Record<string, any>) => Promise<any>;
}

export interface ComponentEntry {
  component: ComponentType<SectionProps>;
  label: string;
  icon: string;
  description: string;
}

// ── Registry ────────────────────────────────────────────────────────

const registry = new Map<string, ComponentEntry>();

export function registerComponent(type: string, entry: ComponentEntry): void {
  registry.set(type, entry);
}

export function getComponent(type: string): ComponentEntry | undefined {
  return registry.get(type);
}

export function getAllComponents(): ComponentEntry[] {
  return Array.from(registry.values());
}

export function getComponentTypes(): string[] {
  return Array.from(registry.keys());
}

export function hasComponent(type: string): boolean {
  return registry.has(type);
}
