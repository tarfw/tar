/**
 * UI Memory Module.
 */

export interface UIMemory {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'staff' | 'customer';
}

export function getMemory() { return null; }
