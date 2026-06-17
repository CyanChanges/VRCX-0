import { commands } from './bindings';
import { normalizePlatformError } from './errors';

// Mirror of the Rust command naming so a PascalCase app method name resolves to
// the generated client function (e.g. "GetUGCPhotoLocation" ->
// "appGetUgcPhotoLocation").
function appCommandFnName(methodName: string): string {
    const snake = methodName
        .replace(/VRChat/g, 'Vrchat')
        .replace(/SteamVR/g, 'Steamvr')
        .replace(/IPC/g, 'Ipc')
        .replace(/VRCX/g, 'Vrcx')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase();
    return `app__${snake}`
        .split(/_+/)
        .map((word, index) =>
            index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join('');
}

export async function invokeAppCommand<TReturn = unknown>(
    methodName: string,
    ...args: unknown[]
): Promise<TReturn> {
    const fn = (
        commands as Record<string, (...a: unknown[]) => Promise<unknown>>
    )[appCommandFnName(methodName)];
    if (!fn) {
        throw normalizePlatformError(
            new Error(`Unknown app command: ${methodName}`),
            `App command failed: ${methodName}`
        );
    }
    return (await fn(...args)) as TReturn;
}
