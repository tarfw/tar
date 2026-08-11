/**
 * tarsite — OKF Universal Contract CSS Engine
 * Maps raw Section Contract properties into CSS Custom Variables for 0-branch Edge compilation.
 */

import { type SectionContract, type DesignTokens } from './types';

export function buildContractCssVars(
  contract: Record<string, any> = {},
  tokens?: DesignTokens
): string {
  const vars: string[] = [];

  // Contract variables mapping
  if (contract.columns !== undefined) vars.push(`--grid-cols: ${contract.columns}`);
  if (contract.aspect_ratio) vars.push(`--aspect-ratio: ${contract.aspect_ratio}`);
  if (contract.hover_zoom !== undefined) vars.push(`--hover-zoom: ${contract.hover_zoom}`);
  if (contract.gap) vars.push(`--grid-gap: ${contract.gap}`);
  if (contract.card_bg) vars.push(`--card-bg: ${contract.card_bg}`);
  if (contract.card_border) vars.push(`--card-border: ${contract.card_border}`);
  if (contract.card_radius) vars.push(`--card-radius: ${contract.card_radius}`);
  if (contract.backdrop_blur) vars.push(`--backdrop-blur: ${contract.backdrop_blur}`);
  if (contract.bg) vars.push(`--section-bg: ${contract.bg}`);
  if (contract.text_color) vars.push(`--section-text: ${contract.text_color}`);
  if (contract.cta_bg) vars.push(`--cta-bg: ${contract.cta_bg}`);
  if (contract.cta_text) vars.push(`--cta-text: ${contract.cta_text}`);
  if (contract.height) vars.push(`--hero-height: ${contract.height}`);
  if (contract.speed) vars.push(`--marquee-speed: ${contract.speed}`);

  // Inherit design tokens as fallbacks
  if (tokens) {
    if (tokens.typography) {
      if (tokens.typography.fontHeading) vars.push(`--font-heading: '${tokens.typography.fontHeading}', sans-serif`);
      if (tokens.typography.fontBody) vars.push(`--font-body: '${tokens.typography.fontBody}', sans-serif`);
    }
    if (tokens.colors) {
      if (tokens.colors.primary) vars.push(`--color-primary: ${tokens.colors.primary}`);
      if (tokens.colors.secondary) vars.push(`--color-secondary: ${tokens.colors.secondary}`);
      if (tokens.colors.background) vars.push(`--color-bg: ${tokens.colors.background}`);
      if (tokens.colors.surface) vars.push(`--color-surface: ${tokens.colors.surface}`);
      if (tokens.colors.text) vars.push(`--color-text: ${tokens.colors.text}`);
      if (tokens.colors.muted) vars.push(`--color-muted: ${tokens.colors.muted}`);
      if (tokens.colors.border) vars.push(`--color-border: ${tokens.colors.border}`);
    }
    if (tokens.radii) {
      if (tokens.radii.sm) vars.push(`--radius-sm: ${tokens.radii.sm}`);
      if (tokens.radii.md) vars.push(`--radius-md: ${tokens.radii.md}`);
      if (tokens.radii.lg) vars.push(`--radius-lg: ${tokens.radii.lg}`);
      if (tokens.radii.full) vars.push(`--radius-full: ${tokens.radii.full}`);
    }
    if (tokens.spacing) {
      if (tokens.spacing.xs) vars.push(`--space-xs: ${tokens.spacing.xs}`);
      if (tokens.spacing.sm) vars.push(`--space-sm: ${tokens.spacing.sm}`);
      if (tokens.spacing.md) vars.push(`--space-md: ${tokens.spacing.md}`);
      if (tokens.spacing.lg) vars.push(`--space-lg: ${tokens.spacing.lg}`);
      if (tokens.spacing.xl) vars.push(`--space-xl: ${tokens.spacing.xl}`);
    }
  }

  return vars.join('; ');
}
