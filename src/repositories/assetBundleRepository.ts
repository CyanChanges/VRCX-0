import { tauriClient } from '@/platform/tauri/client';
import type { AssetBundleCacheCheckResult } from '@/platform/tauri/client';

export async function getVRChatCacheFullLocation(
    fileId: string,
    fileVersion: number,
    variant: string,
    variantVersion: number
): Promise<string> {
    return tauriClient.assetBundle.GetVRChatCacheFullLocation(
        fileId,
        fileVersion,
        variant,
        variantVersion
    );
}

export async function checkVRChatCache(
    fileId: string,
    fileVersion: number,
    variant: string,
    variantVersion: number
): Promise<AssetBundleCacheCheckResult> {
    return tauriClient.assetBundle.CheckVRChatCache(
        fileId,
        fileVersion,
        variant,
        variantVersion
    );
}

export async function deleteCache(
    fileId: string,
    fileVersion: number,
    variant: string,
    variantVersion: number
): Promise<void> {
    await tauriClient.assetBundle.DeleteCache(
        fileId,
        fileVersion,
        variant,
        variantVersion
    );
}

export async function deleteAllCache(): Promise<void> {
    await tauriClient.assetBundle.DeleteAllCache();
}

export async function sweepCache(): Promise<string[]> {
    return tauriClient.assetBundle.SweepCache();
}

export async function getCacheSize(): Promise<number> {
    return Number(await tauriClient.assetBundle.GetCacheSize()) || 0;
}

export const assetBundleRepository = Object.freeze({
    checkVRChatCache,
    deleteAllCache,
    deleteCache,
    getCacheSize,
    getVRChatCacheFullLocation,
    sweepCache
});

export default assetBundleRepository;
