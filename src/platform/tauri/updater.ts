import { Channel } from '@tauri-apps/api/core';

import { invokeTauri } from './invoke';

type TauriUpdateRequest = Record<string, unknown>;
type TauriUpdateEventHandler = (event: unknown) => void;

export async function checkTauriUpdate(
    request: TauriUpdateRequest
): Promise<unknown> {
    return invokeTauri('app__check_tauri_update', request);
}

export async function downloadAndInstallTauriUpdate(
    request: TauriUpdateRequest,
    onEvent: TauriUpdateEventHandler
): Promise<unknown> {
    return invokeTauri('app__download_and_install_tauri_update', {
        ...request,
        onEvent: new Channel(onEvent)
    });
}
