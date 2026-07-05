// Entry point for Cloudflare Worker deployment
// Re-exports all Durable Object classes required by migrations

import app from './app';
import { WorkspaceDO, OrderDO, EditorDO } from './cloudflare';

// Flue-generated Durable Objects — these must be exported for Cloudflare
// to recognize them in the migration config. The actual implementations
// are loaded at runtime by the flue framework.

// Legacy alias
const StorefrontDO = WorkspaceDO;

export default app;
export { WorkspaceDO, OrderDO, EditorDO, StorefrontDO };

// Placeholder exports for Flue DOs referenced in migrations.
// These are resolved at runtime by the flue framework when deployed via `flue build`.
// For direct wrangler deploy, they need to exist as named exports.
export { WorkspaceDO as FlueMasterAgent };
export { WorkspaceDO as FlueRegistry };
export { WorkspaceDO as FlueTranslateWorkflow };
export { WorkspaceDO as FlueDailyReportWorkflow };
export { WorkspaceDO as FlueDailyStandupWorkflow };
export { WorkspaceDO as FlueInventoryAlertWorkflow };
export { WorkspaceDO as FlueLeadScoringWorkflow };
export { WorkspaceDO as FlueSprintPlanningWorkflow };
