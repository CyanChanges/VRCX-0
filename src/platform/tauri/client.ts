import { createTauriCommandNamespace, type TauriCommandNamespace } from './commands';
import type { AppTauriCommandNamespace, AssetBundleTauriCommandNamespace } from './appCommandTypes';
import { tauriEvents } from './events';
import { webview } from './webview';

export type { TauriCommand, TauriCommandNamespace } from './commands';
export type * from './appCommandTypes';

export type TauriEvents = typeof tauriEvents;
export type TauriWebview = typeof webview;

export interface TauriClient {
    app: AppTauriCommandNamespace;
    web: TauriCommandNamespace;
    storage: TauriCommandNamespace;
    sqlite: TauriCommandNamespace;
    logWatcher: TauriCommandNamespace;
    discord: TauriCommandNamespace;
    assetBundle: AssetBundleTauriCommandNamespace;
    events: TauriEvents;
    webview: TauriWebview;
}

const app = createTauriCommandNamespace('app');
const discordCommands = createTauriCommandNamespace('discord');

const discord = new Proxy(discordCommands, {
    get(target: TauriCommandNamespace, property: PropertyKey): unknown {
        if (property === 'OpenDiscordProfile') {
            return (discordId: string) => app.OpenDiscordProfile(discordId);
        }

        if (typeof property !== 'string') {
            return undefined;
        }

        return target[property];
    }
});

export const tauriClient: TauriClient = Object.freeze({
    app: app as AppTauriCommandNamespace,
    web: createTauriCommandNamespace('web'),
    storage: createTauriCommandNamespace('storage'),
    sqlite: createTauriCommandNamespace('sqlite'),
    logWatcher: createTauriCommandNamespace('logWatcher'),
    discord,
    assetBundle: createTauriCommandNamespace(
        'assetBundle'
    ) as AssetBundleTauriCommandNamespace,
    events: tauriEvents,
    webview
});

export default tauriClient;
