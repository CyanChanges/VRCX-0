import { tauriClient } from '@/platform/tauri/client';
import { useNotificationStore } from '@/state/notificationStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { useSessionStore } from '@/state/sessionStore';

import { recordRuntimeGameClientEvent } from './gameClientLifecycle';
import {
    applyRuntimeGameLogProjection,
    ingestRuntimeGameLogEvent,
    resetNowPlayingState
} from './gameLogIngestService';
import { handleGameRunningUpdate } from './gameStateService';
import {
    isHostCapabilityAvailable,
    refreshHostCapabilities
} from './hostCapabilityService';
import { handleIpcEvent } from './ipcEventService';
import { pushSharedFeedNotification } from './sharedFeedFilterService';
import { showSQLiteErrorDialog } from './sqliteErrorDialogService';
import { handleBrowserFocus } from './vrcStatusService';

type RuntimeEventName =
    | 'addGameLogEvent'
    | 'gameLogProjection'
    | 'gameLogPersistenceFallback'
    | 'gameLogSideEffect'
    | 'gameClientEvent'
    | 'runtimeWorkerError'
    | 'updateIsGameRunning'
    | 'ipcEvent'
    | 'browserFocus';

type CapabilityStatus = {
    available?: unknown;
};

type HostCapabilitySnapshot = Record<string, unknown> & {
    platform?: unknown;
    gameLogWatcher?: CapabilityStatus;
    vrchatPathDiscovery?: CapabilityStatus;
};

type RuntimeEventUnsubscribe = () => void;

let gameLogIngestQueue: Promise<unknown> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object');
}

function normalizeString(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function isRuntimePersistedGameLogMirror(payload: unknown): boolean {
    return isRecord(payload) && payload.runtimePersisted === true;
}

function publishNowPlayingSharedFeed(payload: Record<string, unknown>): void {
    const videoUrl = normalizeString(payload.videoUrl || payload.url);
    if (!videoUrl) {
        return;
    }

    const videoName = normalizeString(payload.videoName || payload.name);
    const displayName = normalizeString(payload.displayName);
    const message = [
        videoName || videoUrl,
        displayName ? `(${displayName})` : ''
    ]
        .filter(Boolean)
        .join(' ');

    pushSharedFeedNotification({
        ...payload,
        created_at:
            normalizeString(payload.created_at) ||
            normalizeString(payload.startedAt) ||
            new Date().toISOString(),
        type: 'VideoPlay',
        videoUrl,
        videoName,
        videoId: normalizeString(payload.videoId || payload.source),
        location: normalizeString(payload.location),
        displayName,
        userId: normalizeString(payload.userId),
        message,
        notyName: message
    }).catch((error: any) => {
        console.warn(
            'Failed to publish runtime video shared feed notification:',
            error
        );
    });
}

async function canIngestGameLogEvent(): Promise<boolean> {
    if (isHostCapabilityAvailable('gameLogWatcher')) {
        return true;
    }

    const capabilities = useRuntimeStore.getState()
        .hostCapabilities as HostCapabilitySnapshot;
    if (
        capabilities?.platform !== 'linux' ||
        !capabilities?.vrchatPathDiscovery?.available
    ) {
        return false;
    }

    try {
        const refreshed = await refreshHostCapabilities();
        return Boolean(refreshed?.gameLogWatcher?.available);
    } catch (error) {
        console.warn('Failed to refresh GameLog capability:', error);
        return false;
    }
}

async function ingestAndRecordGameLogEvent(
    name: RuntimeEventName,
    payload: unknown
): Promise<void> {
    const runtimePersisted = isRuntimePersistedGameLogMirror(payload);
    if (runtimePersisted) {
        useRuntimeStore.getState().recordRuntimeEvent(name, payload);
        return;
    }
    if (!runtimePersisted && !(await canIngestGameLogEvent())) {
        return;
    }

    try {
        await ingestRuntimeGameLogEvent(payload);
        useRuntimeStore.getState().recordRuntimeEvent(name, payload);
    } catch (error) {
        await showSQLiteErrorDialog(error);
        useNotificationStore.getState().pushNotification({
            level: 'warning',
            title: 'Game log ingest failed',
            message: error instanceof Error ? error.message : String(error)
        });
    }
}

function recordGameLogPersistenceTelemetry(
    name: RuntimeEventName,
    payload: unknown
): void {
    useRuntimeStore.getState().recordRuntimeEvent(name, payload);
    const record = isRecord(payload) ? payload : {};
    const errorMessage = normalizeString(record.error);
    if (errorMessage) {
        console.warn('Backend GameLog persistence failed:', errorMessage);
    }
}

function handleRuntimeEvent(name: RuntimeEventName, payload: unknown): void {
    const runtimeStore = useRuntimeStore.getState();

    if (name === 'addGameLogEvent') {
        gameLogIngestQueue = gameLogIngestQueue.then(
            () => ingestAndRecordGameLogEvent(name, payload),
            () => ingestAndRecordGameLogEvent(name, payload)
        );
        return;
    }

    if (name === 'gameLogPersistenceFallback') {
        recordGameLogPersistenceTelemetry(name, payload);
        return;
    }

    runtimeStore.recordRuntimeEvent(name, payload);

    if (name === 'gameLogProjection') {
        if (!isHostCapabilityAvailable('runtimeGameLogIngest')) {
            return;
        }
        applyRuntimeGameLogProjection(payload);
        return;
    }

    if (name === 'gameLogSideEffect') {
        if (!isHostCapabilityAvailable('runtimeGameLogSideEffects')) {
            return;
        }
        const record = isRecord(payload) ? payload : {};
        const kind = String(record.kind || '');
        const sidePayload = isRecord(record.payload) ? record.payload : {};
        if (kind === 'nowPlaying') {
            runtimeStore.setNowPlayingState(sidePayload);
            publishNowPlayingSharedFeed(sidePayload);
        } else if (kind === 'nowPlayingReset') {
            resetNowPlayingState();
        } else if (kind === 'screenshotProcessed') {
            runtimeStore.setGameState({
                lastScreenshotPath: String(sidePayload.path || '')
            });
        } else if (kind === 'gameNoVR') {
            runtimeStore.setGameState({
                isGameNoVR: Boolean(sidePayload.isGameNoVR)
            });
        } else if (kind === 'notification') {
            useNotificationStore.getState().pushNotification(sidePayload);
        }
        return;
    }

    if (name === 'gameClientEvent') {
        if (!isHostCapabilityAvailable('runtimeGameClientLifecycle')) {
            return;
        }
        const record = isRecord(payload) ? payload : {};
        const kind = String(record.kind || '');
        const clientPayload = isRecord(record.payload) ? record.payload : {};
        recordRuntimeGameClientEvent(kind, clientPayload);
        if (kind === 'notification') {
            useNotificationStore.getState().pushNotification(clientPayload);
        }
        return;
    }

    if (name === 'runtimeWorkerError') {
        console.warn('Backend worker error:', payload);
        return;
    }

    if (name === 'updateIsGameRunning') {
        if (!isHostCapabilityAvailable('gameProcessMonitor')) {
            return;
        }
        handleGameRunningUpdate(payload).catch((error: any) => {
            useNotificationStore.getState().pushNotification({
                level: 'warning',
                title: 'Game state update failed',
                message: error instanceof Error ? error.message : String(error)
            });
        });
        return;
    }

    if (name === 'ipcEvent') {
        if (!isHostCapabilityAvailable('ipc')) {
            return;
        }
        handleIpcEvent(payload).catch((error: any) => {
            useNotificationStore.getState().pushNotification({
                level: 'warning',
                title: 'IPC event failed',
                message: error instanceof Error ? error.message : String(error)
            });
        });
        return;
    }

    if (name === 'browserFocus') {
        runtimeStore.setGameState({
            lastBrowserFocusAt: new Date().toISOString()
        });
        handleBrowserFocus().catch((error: any) => {
            console.warn('Browser focus status refresh failed:', error);
        });
    }
}

export async function bindRuntimeEvents(): Promise<() => void> {
    const unsubscribers: RuntimeEventUnsubscribe[] = [];
    const events: RuntimeEventName[] = [
        'addGameLogEvent',
        'gameLogProjection',
        'gameLogPersistenceFallback',
        'gameLogSideEffect',
        'gameClientEvent',
        'runtimeWorkerError',
        'updateIsGameRunning',
        'ipcEvent',
        'browserFocus'
    ];

    useSessionStore.getState().setTransportStatus('runtime-subscribing');

    try {
        for (const name of events) {
            const unsubscribe = await tauriClient.events.subscribe(
                name,
                (payload: any) => {
                    handleRuntimeEvent(name, payload);
                }
            );
            unsubscribers.push(unsubscribe);
        }
    } catch (error) {
        for (const unsubscribe of unsubscribers) {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }
        useSessionStore.getState().setTransportStatus('disconnected');
        throw error;
    }

    useSessionStore.getState().setTransportStatus('runtime-subscribed');

    return () => {
        for (const unsubscribe of unsubscribers) {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }
        useSessionStore.getState().setTransportStatus('disconnected');
    };
}
