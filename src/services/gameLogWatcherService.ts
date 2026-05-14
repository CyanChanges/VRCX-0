import { tauriClient } from '@/platform/tauri/client';

export async function getCurrentLogLocation(): Promise<unknown> {
    return tauriClient.logWatcher.GetCurrentLocation();
}
