/**
 * Re-exports from gen-ui/types.ts for backward compatibility.
 * The canonical types live in gen-ui/types.ts.
 */

export {
  UINodeSchema,
  UIRouteSchema,
  SiteLayoutSchema,
  validateSiteLayout,
  flattenNodes,
  type UINode,
  type UIRoute,
  type SiteLayout,
  type ComponentCatalogEntry,
  type ResourceCatalogEntry,
  type ActionCatalogEntry,
  type UIMemory,
  UIMemorySchema,
  type PlannerContext,
  type UIRevision,
} from './gen-ui/types';
