import { useEffect, useMemo, useRef, useState } from 'react';

import friendLogHistoryRepository from '@/repositories/friendLogHistoryRepository';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import { matchesSearch, normalizeUserId, sortRows } from './friendLogRows';

export function useFriendLogRows({
    refreshToken,
    searchQuery,
    selectedTypes
}: {
    refreshToken: number;
    searchQuery: string;
    selectedTypes: any[];
}) {
    const currentUserId = useRuntimeStore((state: any) => state.auth.currentUserId);
    const hideUnfriends = usePreferencesStore((state: any) => state.hideUnfriends);
    const [rows, setRows] = useState<any[]>([]);
    const [rowsOwnerUserId, setRowsOwnerUserId] = useState('');
    const [loadStatus, setLoadStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const rowsOwnerUserIdRef = useRef('');

    function updateRowsOwnerUserId(ownerUserId: any) {
        const normalizedOwnerUserId = normalizeUserId(ownerUserId);
        rowsOwnerUserIdRef.current = normalizedOwnerUserId;
        setRowsOwnerUserId(normalizedOwnerUserId);
    }

    useEffect(() => {
        let active = true;

        if (!currentUserId) {
            setRows([]);
            updateRowsOwnerUserId('');
            setLoadStatus('idle');
            setDetail('No authenticated user is available for friend history.');
            return () => {
                active = false;
            };
        }

        setLoadStatus('running');
        setDetail('');
        setRows([]);
        updateRowsOwnerUserId(currentUserId);

        friendLogHistoryRepository
            .getFriendLogHistory(currentUserId)
            .then((nextRows: any) => {
                if (!active) {
                    return;
                }

                setRows(Array.isArray(nextRows) ? nextRows : []);
                updateRowsOwnerUserId(currentUserId);
                setLoadStatus('ready');
                setDetail('');
            })
            .catch(() => {
                if (!active) {
                    return;
                }

                setRows([]);
                updateRowsOwnerUserId(currentUserId);
                setLoadStatus('error');
                setDetail('');
            });

        return () => {
            active = false;
        };
    }, [currentUserId, refreshToken]);

    const filteredRows = useMemo(() => {
        const activeTypeSet = selectedTypes.length
            ? new Set(selectedTypes)
            : null;

        return rows.filter((row: any) => {
            if (hideUnfriends && row?.type === 'Unfriend') {
                return false;
            }
            if (activeTypeSet && !activeTypeSet.has(row?.type)) {
                return false;
            }
            return matchesSearch(row, searchQuery);
        });
    }, [hideUnfriends, rows, searchQuery, selectedTypes]);

    const orderedRows = useMemo(() => sortRows(filteredRows), [filteredRows]);

    return {
        currentUserId,
        detail,
        hideUnfriends,
        loadStatus,
        orderedRows,
        rows,
        rowsOwnerUserId,
        rowsOwnerUserIdRef,
        setDetail,
        setRows
    };
}
