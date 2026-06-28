import { useEffect, useState } from 'react';

import { normalizeFriendListId as normalizeId } from './friendListRows';

export function useFriendListSelection({
    filteredRows
}: {
    filteredRows: any[];
}) {
    const [bulkUnfriendMode, setBulkUnfriendMode] = useState(false);
    const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());
    const [deletingFriendIds, setDeletingFriendIds] = useState(() => new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => {
        if (!bulkUnfriendMode) {
            setSelectedFriendIds(new Set());
        }
    }, [bulkUnfriendMode]);

    useEffect(() => {
        const visibleFriendIds = new Set(
            filteredRows
                .map((friend) => normalizeId(friend?.id))
                .filter(Boolean)
        );
        setSelectedFriendIds((current: any) => {
            const next = new Set(
                [...current].filter((friendId) =>
                    visibleFriendIds.has(friendId)
                )
            );
            return next.size === current.size ? current : next;
        });
    }, [filteredRows]);

    return {
        bulkUnfriendMode,
        deletingFriendIds,
        isBulkDeleting,
        selectedFriendIds,
        setBulkUnfriendMode,
        setDeletingFriendIds,
        setIsBulkDeleting,
        setSelectedFriendIds
    };
}
