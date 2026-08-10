/**
 * Canonical UIPlan and Site types for TAR.
 * Re-exports cleanly from tarsite UIPlan Runtime Engine.
 */

export {
  UINodeSchema,
  UIRouteSchema,
  UIPlanSchema as SiteLayoutSchema,
  validateUIPlan as validateSiteLayout,
  type UINode,
  type UIRoute,
  type UIPlan as SiteLayout,
  type DesignTokens,
  type UIRevision,
} from '../tarsite/src/types';
