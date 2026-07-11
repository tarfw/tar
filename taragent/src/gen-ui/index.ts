/**
 * Gen UI module — exports all public APIs.
 */

// Types and schemas
export * from './types';

// Catalogs
export { COMPONENT_CATALOG, getCatalogEntry, getCatalogTypes, isValidType } from './catalog';
export { RESOURCE_CATALOG, getResourceEntry, getResourceIds, isValidResource, resolveResource } from './resources';
export { ACTION_CATALOG, getActionEntry, getActionIds, isValidAction, executeAction } from './actions';

// Planner
export { generatePlan } from './planner';

// Validation and storage
export { validatePlan, storeRevision, getActiveRevision } from './validator';

// Memory
export { getMemory, saveMemory, updateMemory, buildPlannerContext, applyMemoryPriority } from './memory';

// Publishing
export { createPreview, approveRevision, promoteRevision, rejectRevision } from './publisher';

// API routes
export { default as genUiRoutes } from './api';
