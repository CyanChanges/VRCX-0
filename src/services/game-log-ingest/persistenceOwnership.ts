const RUNTIME_GAME_LOG_INGEST_TYPES = new Set([
    'location',
    'location-destination',
    'player-joined',
    'player-left',
    'portal-spawn',
    'resource-load-string',
    'resource-load-image',
    'event',
    'external'
]);

const RUNTIME_GAME_LOG_SIDE_EFFECT_TYPES = new Set([
    'video-play',
    'video-sync',
    'vrcx',
    'api-request',
    'screenshot',
    'sticker-spawn',
    'vrc-quit',
    'openvr-init',
    'desktop-mode',
    'udon-exception'
]);

type GameLogLike = {
    type?: unknown;
    runtimePersisted?: unknown;
};

export function isRuntimePersistedGameLogMirror(gameLog: GameLogLike): boolean {
    return gameLog?.runtimePersisted === true;
}

export function isRuntimePersistedGameLogType(type: unknown): boolean {
    return RUNTIME_GAME_LOG_INGEST_TYPES.has(String(type || ''));
}

export function shouldSkipRuntimePersistedGameLog(
    gameLog: GameLogLike,
    options: { runtimeGameLogIngestAvailable: boolean }
): boolean {
    return (
        isRuntimePersistedGameLogMirror(gameLog) ||
        (options.runtimeGameLogIngestAvailable &&
            isRuntimePersistedGameLogType(gameLog?.type))
    );
}

export function isRuntimeHandledGameLogSideEffectType(type: unknown): boolean {
    return RUNTIME_GAME_LOG_SIDE_EFFECT_TYPES.has(String(type || ''));
}

export function shouldSkipRuntimeHandledGameLogSideEffect(
    gameLog: GameLogLike,
    options: { runtimeGameLogSideEffectsAvailable: boolean }
): boolean {
    return (
        options.runtimeGameLogSideEffectsAvailable &&
        isRuntimeHandledGameLogSideEffectType(gameLog?.type)
    );
}
