import { executeRead } from './helpers';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Validates if the user is authorized for the given workspace scope.
 * 
 * - If the scope is personal (e.g., "p:userId"), only the matched user can access.
 * - If the scope is a workspace (e.g., "w:subdomain"), validates against D1 that the user is the owner,
 *   or checks the graph database for relationship (works_for, member_of, customer_of).
 */
export async function validateUserScope(
  d1: any,
  userId: string,
  scope: string
): Promise<{ authorized: boolean; role: 'owner' | 'member' | 'none' }> {
  // 1. Personal scope check
  if (scope.startsWith('p:')) {
    const isSelf = scope === `p:${userId}`;
    return {
      authorized: isSelf,
      role: isSelf ? 'owner' : 'none',
    };
  }

  // 2. Global scope is public read-only, but let's allow read/write depending on requirements
  if (scope === 'global') {
    return { authorized: true, role: 'owner' };
  }

  // 3. Workspace scope check: w:subdomain
  if (scope.startsWith('w:')) {
    const subdomain = scope.replace('w:', '');
    
    // Check D1 workspaces table first
    if (d1) {
      const workspace = await d1.prepare(
        'SELECT user_id FROM workspaces WHERE subdomain = ?'
      ).bind(subdomain).first();

      if (workspace) {
        if (workspace.user_id === userId) {
          return { authorized: true, role: 'owner' };
        }
      }
    }

    // Fallback: Check the graph relation in Turso for membership
    try {
      const edges = await executeRead({
        table: 'graph',
        src: userId,
        tgt: scope,
      }) as any;

      if (edges && edges.rows && edges.rows.length > 0) {
        const relationship = edges.rows[0].rel;
        const isValidRole = ['member_of', 'works_for', 'customer_of', 'owns'].includes(relationship);
        if (isValidRole) {
          return {
            authorized: true,
            role: relationship === 'owns' ? 'owner' : 'member',
          };
        }
      }
    } catch (err) {
      console.warn('[auth-scopes] Graph relation check skipped or failed:', err);
    }
  }

  return { authorized: false, role: 'none' };
}

/**
 * Asserts that the caller has access to the workspace scope.
 * Throws ForbiddenError if unauthorized.
 */
export async function enforceScopeAccess(
  d1: any,
  userId: string,
  scope: string,
  requiredRole: 'owner' | 'member' = 'member'
): Promise<void> {
  const { authorized, role } = await validateUserScope(d1, userId, scope);
  if (!authorized) {
    throw new ForbiddenError(`User ${userId} does not have access to scope ${scope}`);
  }
  if (requiredRole === 'owner' && role !== 'owner') {
    throw new ForbiddenError(`User ${userId} lacks owner permission for scope ${scope}`);
  }
}
