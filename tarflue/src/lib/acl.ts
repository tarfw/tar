import { cachedSelfId, getPreparedDbForScope } from './db';
import type { Database } from '@tursodatabase/sync-react-native';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export type RoleWeight = -1 | 0 | 1 | 2 | 3;

export function getCallerId(): string {
  return cachedSelfId || 'guest';
}

export function isPersonalScope(scope: string): boolean {
  return scope === 'p' || scope.startsWith('p:');
}

/**
 * Determine the caller's role in a scope.
 * - Owner of the scope form/matter record → 3
 * - Graph edge member_of / works_for / customer_of / owns → weight from graph
 * - No relation → -1 (no access, except public reads)
 */
export async function getRole(
  db: Database,
  personId: string,
  scope: string
): Promise<RoleWeight> {
  if (isPersonalScope(scope)) {
    return scope === `p:${personId}` ? 3 : -1;
  }

  // Direct ownership of scope root record
  const owner = await db.get(
    'SELECT owner FROM form WHERE id = ? UNION ALL SELECT owner FROM matter WHERE id = ? LIMIT 1',
    [scope, scope]
  ).catch(() => null);
  if (owner?.owner === personId) return 3;

  const edge = await db.get(
    `SELECT weight FROM graph
      WHERE src = ? AND tgt = ? AND rel IN ('member_of','works_for','customer_of','owns')
      AND active = 1
      ORDER BY weight DESC LIMIT 1`,
    [personId, scope]
  ).catch(() => null);

  return (edge?.weight ?? -1) as RoleWeight;
}

/**
 * Legacy owner-equality check. Kept for backwards compatibility.
 */
export function isAuthorized(
  scope: string,
  owner: string | null | undefined,
  caller: string = getCallerId()
): boolean {
  if (!owner) return true;
  return owner === caller;
}

export function requireOwner(
  scope: string,
  owner: string | null | undefined,
  caller: string = getCallerId()
): void {
  if (!isAuthorized(scope, owner, caller)) {
    throw new UnauthorizedError(`Not authorized for scope ${scope}`);
  }
}

// Permission predicates -----------------------------------------------------

export function canRead(role: RoleWeight, isPublic: boolean): boolean {
  return isPublic || role >= 0;
}

export function canCreate(role: RoleWeight): boolean {
  return role >= 1;
}

export function canUpdate(
  role: RoleWeight,
  owner: string | null | undefined,
  caller: string
): boolean {
  return role >= 2 || owner === caller;
}

export function canDelete(
  role: RoleWeight,
  owner: string | null | undefined,
  caller: string,
  scope: string
): boolean {
  // Personal data: owner can hard-delete; others cannot
  if (isPersonalScope(scope)) return owner === caller;
  // Workspace/store: admin+ can soft-delete
  return role >= 2;
}

// Async enforcement helpers -------------------------------------------------

export async function requireCanRead(
  scope: string,
  publicFlag: boolean = false
): Promise<void> {
  const caller = getCallerId();
  const db = await getPreparedDbForScope(scope);
  const role = await getRole(db, caller, scope);
  if (!canRead(role, publicFlag)) {
    throw new UnauthorizedError(`Read not authorized for scope ${scope}`);
  }
}

export async function requireCanCreate(scope: string): Promise<void> {
  const caller = getCallerId();
  const db = await getPreparedDbForScope(scope);
  const role = await getRole(db, caller, scope);
  if (!canCreate(role)) {
    throw new UnauthorizedError(`Create not authorized for scope ${scope}`);
  }
}

export async function requireCanUpdate(
  scope: string,
  owner: string | null | undefined
): Promise<void> {
  const caller = getCallerId();
  const db = await getPreparedDbForScope(scope);
  const role = await getRole(db, caller, scope);
  if (!canUpdate(role, owner, caller)) {
    throw new UnauthorizedError(`Update not authorized for scope ${scope}`);
  }
}

export async function requireCanDelete(
  scope: string,
  owner: string | null | undefined
): Promise<void> {
  const caller = getCallerId();
  const db = await getPreparedDbForScope(scope);
  const role = await getRole(db, caller, scope);
  if (!canDelete(role, owner, caller, scope)) {
    throw new UnauthorizedError(`Delete not authorized for scope ${scope}`);
  }
}
