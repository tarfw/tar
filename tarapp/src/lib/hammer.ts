import { models } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

export const HAMMER_MODEL = models.llm.hammer2_1_0_5b();
export const LFM_MODEL = models.llm.lfm2_5_1_2b_instruct();

/**
 * Checks if the Hammer model files are already cached on device.
 */
export async function isHammerCached(): Promise<boolean> {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return files.some((f) => f.includes('hammer'));
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes("doesn't exist") && !msg.includes("isn't a directory")) {
      console.warn('[hammer] isHammerCached check failed:', e);
    }
    return false;
  }
}

/**
 * Checks if the LFM 2.5 model files are already cached on device.
 */
export async function isLfmCached(): Promise<boolean> {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return files.some((f) => f.includes('lfm_2_5_1_2b') || f.includes('lfm2.5-1.2b'));
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes("doesn't exist") && !msg.includes("isn't a directory")) {
      console.warn('[hammer] isLfmCached check failed:', e);
    }
    return false;
  }
}

/**
 * Deletes the downloaded Hammer model from local cache.
 */
export async function clearHammerModel(): Promise<void> {
  await ExpoResourceFetcher.deleteResources(
    HAMMER_MODEL.modelSource,
    HAMMER_MODEL.tokenizerSource,
    HAMMER_MODEL.tokenizerConfigSource
  );
}

/**
 * Deletes the downloaded LFM 2.5 model from local cache.
 */
export async function clearLfmModel(): Promise<void> {
  await ExpoResourceFetcher.deleteResources(
    LFM_MODEL.modelSource,
    LFM_MODEL.tokenizerSource,
    LFM_MODEL.tokenizerConfigSource
  );
}
