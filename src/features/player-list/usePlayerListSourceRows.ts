import { useMemo } from 'react';

import { useCurrentInstancePresence } from '@/domain/presence/useCurrentInstancePresence';

import { buildPlayerSourceRows } from './playerListRows';

export function usePlayerListSourceRows({
    context,
    currentLocationStartedAt,
    currentUserId,
    currentUserLocation,
    currentUserSnapshot,
    isGameRunning,
    playerRows,
    runtimePlayerRows
}: any) {
    const domainCurrentInstancePresence = useCurrentInstancePresence();

    return useMemo(() => {
        const domainRuntimeRows = domainCurrentInstancePresence
            ? Object.values(domainCurrentInstancePresence.playersById || {})
            : [];
        return buildPlayerSourceRows({
            context,
            currentLocationStartedAt,
            currentUserId,
            currentUserLocation,
            currentUserSnapshot,
            isGameRunning,
            playerRows,
            runtimePlayerRows:
                runtimePlayerRows && runtimePlayerRows.length
                    ? runtimePlayerRows
                    : domainRuntimeRows
        });
    }, [
        context,
        currentLocationStartedAt,
        currentUserId,
        currentUserLocation,
        currentUserSnapshot,
        domainCurrentInstancePresence,
        isGameRunning,
        playerRows,
        runtimePlayerRows
    ]);
}
