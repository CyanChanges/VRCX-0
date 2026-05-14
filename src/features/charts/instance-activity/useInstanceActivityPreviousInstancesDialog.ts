import { useState } from 'react';

export function useInstanceActivityPreviousInstancesDialog() {
    const [previousInstanceOpen, setPreviousInstanceOpen] = useState(false);
    const [previousInstanceRows, setPreviousInstanceRows] = useState<any[]>([]);
    const [previousInstanceTitle, setPreviousInstanceTitle] =
        useState('Instance Details');

    function openPreviousInstanceInfo(row: any) {
        if (!row?.location) {
            return;
        }
        setPreviousInstanceRows([row]);
        setPreviousInstanceTitle('Instance Details');
        setPreviousInstanceOpen(true);
    }

    return {
        openPreviousInstanceInfo,
        previousInstanceOpen,
        previousInstanceRows,
        previousInstanceTitle,
        setPreviousInstanceOpen
    };
}
