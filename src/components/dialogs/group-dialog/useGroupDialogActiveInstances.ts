import { useMemo, useState } from 'react';

import { mergeGroupInstances } from './groupInstances';

export function useGroupDialogActiveInstances({
    groupId,
    friendsById,
    currentUserSnapshot,
    currentLocation
}: any) {
    const [rawActiveInstances, setRawActiveInstances] = useState<any[]>([]);
    const activeInstances = useMemo(
        () =>
            mergeGroupInstances(rawActiveInstances, {
                groupId,
                friendsById,
                currentUserSnapshot,
                currentLocation
            }),
        [
            currentLocation,
            currentUserSnapshot,
            friendsById,
            groupId,
            rawActiveInstances
        ]
    );

    return {
        activeInstances,
        setRawActiveInstances
    };
}
