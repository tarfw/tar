/**
 * Re-exports from gen-ui/validator.ts and publisher.ts for backward compatibility.
 */

export {
  validatePlan,
  storeRevision,
  getActiveRevision,
} from '../gen-ui/validator';

export {
  createPreview,
  approveRevision,
  promoteRevision,
  rejectRevision,
} from '../gen-ui/publisher';
