import { useShellStore } from '@/state/shellStore.js';

import { setZoomLevelPreference } from './preferencesService.js';
import { normalizeZoomLevel } from './themeService.js';

let applyingZoom = false;
let pendingZoom = null;
let targetZoom = null;
let latestErrorHandler = null;

function getCurrentZoomLevel() {
    return normalizeZoomLevel(useShellStore.getState().zoomLevel);
}

async function flushPendingZoom() {
    if (applyingZoom) {
        return;
    }

    applyingZoom = true;
    try {
        while (pendingZoom !== null) {
            const nextZoom = pendingZoom;
            pendingZoom = null;
            try {
                await setZoomLevelPreference(nextZoom);
                targetZoom = getCurrentZoomLevel();
            } catch (error) {
                targetZoom = getCurrentZoomLevel();
                latestErrorHandler?.(error);
            }
        }
    } finally {
        applyingZoom = false;
        if (pendingZoom !== null) {
            void flushPendingZoom();
        }
    }
}

export function syncQueuedZoomLevel(value) {
    if (applyingZoom || pendingZoom !== null) {
        return;
    }

    targetZoom = normalizeZoomLevel(value);
}

export function queueZoomLevelPreference(value, { onError } = {}) {
    if (typeof onError === 'function') {
        latestErrorHandler = onError;
    }

    targetZoom = normalizeZoomLevel(value);
    pendingZoom = targetZoom;
    void flushPendingZoom();
    return targetZoom;
}

export function stepQueuedZoomLevelPreference(delta, { onError } = {}) {
    const baseZoom = targetZoom ?? getCurrentZoomLevel();
    return queueZoomLevelPreference(baseZoom + delta, { onError });
}
