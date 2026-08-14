/**
 * tarsite — Style Engine
 * Maps layout and style properties into CSS Custom Variables for 0-branch Edge compilation.
 */

import { type DesignTokens } from './types';

export function buildStyleCssVars(
  styleContract: Record<string, any> = {},
  tokens?: DesignTokens
): string {
  const vars: string[] = [];

  // Style variables mapping
  if (styleContract.columns !== undefined) vars.push(`--grid-cols: ${styleContract.columns}`);
  if (styleContract.aspect_ratio) vars.push(`--aspect-ratio: ${styleContract.aspect_ratio}`);
  if (styleContract.hover_zoom !== undefined) vars.push(`--hover-zoom: ${styleContract.hover_zoom}`);
  if (styleContract.gap) vars.push(`--grid-gap: ${styleContract.gap}`);
  if (styleContract.card_bg) vars.push(`--card-bg: ${styleContract.card_bg}`);
  if (styleContract.card_border) vars.push(`--card-border: ${styleContract.card_border}`);
  if (styleContract.card_radius) vars.push(`--card-radius: ${styleContract.card_radius}`);
  if (styleContract.backdrop_blur) vars.push(`--backdrop-blur: ${styleContract.backdrop_blur}`);
  if (styleContract.bg) vars.push(`--section-bg: ${styleContract.bg}`);
  if (styleContract.text_color) vars.push(`--section-text: ${styleContract.text_color}`);
  if (styleContract.cta_bg) vars.push(`--cta-bg: ${styleContract.cta_bg}`);
  if (styleContract.cta_text) vars.push(`--cta-text: ${styleContract.cta_text}`);
  if (styleContract.height) vars.push(`--hero-height: ${styleContract.height}`);
  if (styleContract.speed) vars.push(`--marquee-speed: ${styleContract.speed}`);

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

// Backward-compatibility alias
export const buildContractCssVars = buildStyleCssVars;
