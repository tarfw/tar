/**
 * skills-cache — fetches and caches action list/index for the workspace.
 * Caches skill actions in local secure storage to support offline usage.
 */

import * as SecureStore from 'expo-secure-store';

export interface SkillAction {
  name: string;
  description?: string;
  params?: Record<string, string>;
}

const CACHE_PREFIX = 'skills_cache_';

/**
 * Fetches workspace skills from the worker and saves them to local storage.
 * Falls back to local cache if network request fails.
 */
export async function fetchAndCacheWorkspaceSkills(
  baseUrl: string,
  scope: string,
  userId: string
): Promise<SkillAction[]> {
  try {
    const res = await fetch(`${baseUrl}/workspace/${scope}/skills`, {
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch workspace skills: ${res.status}`);
    }
    const data = await res.json() as { actions?: SkillAction[] };
    const actions = data.actions || [];
    await SecureStore.setItemAsync(`${CACHE_PREFIX}${scope}`, JSON.stringify(actions));
    return actions;
  } catch (err) {
    console.warn(`[SkillsCache] Failed to fetch skills for scope ${scope}:`, err);
    return getCachedWorkspaceSkills(scope);
  }
}

/**
 * Retrieves cached workspace skills from local storage.
 */
export async function getCachedWorkspaceSkills(scope: string): Promise<SkillAction[]> {
  try {
    const data = await SecureStore.getItemAsync(`${CACHE_PREFIX}${scope}`);
    if (data) {
      return JSON.parse(data) as SkillAction[];
    }
  } catch (err) {
    console.warn(`[SkillsCache] Failed to retrieve cached skills for scope ${scope}:`, err);
  }
  return [];
}
