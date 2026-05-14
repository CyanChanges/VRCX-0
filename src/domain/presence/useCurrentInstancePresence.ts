import { useMemo } from 'react';

import { instancePresenceKey } from '@/domain/presence/instancePresence';
import { useInstancePresenceStore } from '@/state/instancePresenceStore';
import { useRuntimeStore } from '@/state/runtimeStore';

function useCurrentInstancePresence() {
    const endpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const currentLocation = useRuntimeStore(
        (state: any) => state.gameState.currentLocation
    );
    const key = useMemo(
        () => instancePresenceKey(endpoint, currentLocation),
        [currentLocation, endpoint]
    );
    return useInstancePresenceStore((state: any) =>
        key ? state.presenceByKey[key] || null : null
    );
}

export { useCurrentInstancePresence };
