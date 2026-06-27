import { cachedSelfId } from './db';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function getCallerId(): string {
  return cachedSelfId || 'guest';
}

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
