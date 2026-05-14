import {
    useState,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import mutualGraphPersistenceRepository from '@/repositories/mutualGraphPersistenceRepository';
import userProfileRepository from '@/repositories/userProfileRepository';
import { openUserDialog } from '@/services/dialogService';
import friendRelationshipService from '@/services/friendRelationshipService';
import { executeWithBackoff } from '@/shared/utils/retry';
import { createRateLimiter } from '@/shared/utils/throttle';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useModalStore } from '@/state/modalStore';
import { useRuntimeStore } from '@/state/runtimeStore';

import { normalizeFriendListId as normalizeId } from './friendListRows';

export function useFriendListRowActions({
    cancelUserLoadRef,
    filteredRows,
    isLoadingUserDetails,
    resetTableLayout,
    rosterRows,
    selectedFriendIds,
    setDeletingFriendIds,
    setIsBulkDeleting,
    setIsLoadingUserDetails,
    setMutualProgress,
    setSelectedFriendIds,
    setUserLoadProgress
}: {
    cancelUserLoadRef: MutableRefObject<boolean>;
    filteredRows: any[];
    isLoadingUserDetails: boolean;
    resetTableLayout(): void;
    rosterRows: any[];
    selectedFriendIds: Set<unknown>;
    setDeletingFriendIds: Dispatch<SetStateAction<Set<unknown>>>;
    setIsBulkDeleting(value: boolean): void;
    setIsLoadingUserDetails(value: boolean): void;
    setMutualProgress(value: any): void;
    setSelectedFriendIds: Dispatch<SetStateAction<Set<unknown>>>;
    setUserLoadProgress(value: any): void;
}) {
    const { t } = useTranslation();
    const currentUserId = useRuntimeStore((state: any) => state.auth.currentUserId);
    const currentEndpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const currentUserSnapshot = useRuntimeStore(
        (state: any) => state.auth.currentUserSnapshot
    );
    const friendsById = useFriendRosterStore((state: any) => state.friendsById);
    const applyFriendPatch = useFriendRosterStore(
        (state: any) => state.applyFriendPatch
    );
    const confirm = useModalStore((state: any) => state.confirm);
    const [isMutualFetching, setIsMutualFetching] = useState(false);

    function setFriendDeleting(userId: any, isDeleting: any) {
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) {
            return;
        }
        setDeletingFriendIds((current: any) => {
            const next = new Set(current);
            if (isDeleting) {
                next.add(normalizedUserId);
            } else {
                next.delete(normalizedUserId);
            }
            return next;
        });
    }

    function toggleSelectedFriend(userId: any) {
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) {
            return;
        }
        setSelectedFriendIds((current: any) => {
            const next = new Set(current);
            if (next.has(normalizedUserId)) {
                next.delete(normalizedUserId);
            } else {
                next.add(normalizedUserId);
            }
            return next;
        });
    }

    async function deleteFriendById(userId: any) {
        const normalizedUserId = normalizeId(userId);
        const friend = friendsById[normalizedUserId];
        if (!normalizedUserId || !friend || !currentUserId) {
            return {
                stale: false,
                deleted: false
            };
        }
        setFriendDeleting(normalizedUserId, true);
        try {
            const result = await friendRelationshipService.deleteFriend({
                friend,
                userId: normalizedUserId,
                endpoint: currentEndpoint,
                currentUserId
            });
            if (!result.stale) {
                setSelectedFriendIds((current: any) => {
                    const next = new Set(current);
                    next.delete(normalizedUserId);
                    return next;
                });
                toast.success(
                    t('view.friends.dynamic.unfriended_value', {
                        value: friend.displayName || normalizedUserId
                    })
                );
            }
            return {
                ...result,
                deleted: !result.stale
            };
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.friends.toast.failed_to_unfriend_value', {
                          value: friend.displayName || normalizedUserId
                      })
            );
            return {
                stale: false,
                deleted: false
            };
        } finally {
            setFriendDeleting(normalizedUserId, false);
        }
    }

    async function confirmDeleteFriend(friend: any) {
        const normalizedUserId = normalizeId(friend?.id);
        if (!normalizedUserId) {
            return;
        }
        const result = await confirm({
            title: t('view.friends.modal.unfriend_user'),
            description: friend?.displayName || normalizedUserId,
            confirmText: t('view.friends.modal.unfriend'),
            cancelText: t('common.actions.cancel'),
            destructive: true
        });
        if (!result.ok) {
            return;
        }
        await deleteFriendById(normalizedUserId);
    }

    async function bulkUnfriendSelected() {
        const selectedRows = filteredRows.filter((friend: any) =>
            selectedFriendIds.has(normalizeId(friend?.id))
        );
        if (!selectedRows.length) {
            return;
        }
        const result = await confirm({
            title: t('view.friends.dynamic.unfriend_value_friends', {
                value: selectedRows.length
            }),
            description: selectedRows
                .map((friend: any) => friend.displayName || friend.id)
                .slice(0, 30)
                .join('\n'),
            confirmText: t('view.friends.modal.unfriend'),
            cancelText: t('common.actions.cancel'),
            destructive: true
        });
        if (!result.ok) {
            return;
        }
        setIsBulkDeleting(true);
        try {
            let deletedCount = 0;
            for (const friend of selectedRows) {
                const deleteResult = await deleteFriendById(friend.id);
                if (deleteResult.stale) {
                    break;
                }
                if (deleteResult.deleted) {
                    deletedCount += 1;
                }
            }
            if (deletedCount > 0) {
                toast.success(
                    t('view.friends.dynamic.unfriended_value_friends', {
                        value: deletedCount
                    })
                );
            }
        } finally {
            setIsBulkDeleting(false);
        }
    }

    async function loadFriendUserDetails() {
        if (isLoadingUserDetails) {
            return;
        }
        const rowsToFetch = rosterRows.filter(
            (friend: any) => normalizeId(friend?.id) && !friend?.date_joined
        );
        if (!rowsToFetch.length) {
            toast.success(
                t('view.friend_list.label.friend_details_are_already_loaded')
            );
            return;
        }
        cancelUserLoadRef.current = false;
        setIsLoadingUserDetails(true);
        setUserLoadProgress({
            current: 0,
            total: rowsToFetch.length,
            open: true,
            cancelled: false
        });
        let loadedCount = 0;
        try {
            for (const friend of rowsToFetch) {
                if (cancelUserLoadRef.current) {
                    break;
                }
                const friendId = normalizeId(friend?.id);
                try {
                    const profile = await userProfileRepository.getUserProfile({
                        userId: friendId,
                        endpoint: currentEndpoint
                    });
                    if (profile?.id) {
                        applyFriendPatch({
                            userId: friendId,
                            patch: profile,
                            stateBucket:
                                friend.stateBucket || friend.state || 'offline'
                        });
                        loadedCount += 1;
                    }
                } catch (error) {
                    console.warn(
                        '[FriendListPage] Failed to load friend profile',
                        friendId,
                        error
                    );
                } finally {
                    setUserLoadProgress((current: any) => ({
                        ...current,
                        current: Math.min(current.total, current.current + 1)
                    }));
                }
            }
            if (cancelUserLoadRef.current) {
                toast.warning(
                    t('view.friend_list.success.friend_detail_loading_cancelled')
                );
                return;
            }
            toast.success(
                t('view.friends.dynamic.loaded_value_friend_profiles', {
                    value: loadedCount
                })
            );
        } finally {
            setIsLoadingUserDetails(false);
            if (!cancelUserLoadRef.current) {
                setUserLoadProgress((current: any) => ({
                    ...current,
                    open: false
                }));
            }
        }
    }

    async function fetchMutualFriendIds(friendId: any, rateLimiter: any) {
        const collected = [];
        let offset = 0;
        while (true) {
            await rateLimiter.wait();
            const response = await executeWithBackoff(
                () =>
                    mutualGraphPersistenceRepository.getMutualFriends({
                        friendId,
                        offset,
                        n: 100
                    }),
                {
                    maxRetries: 4,
                    baseDelay: 500,
                    shouldRetry: (error: any) =>
                        error?.status === 429 ||
                        String(error?.message || '').includes('429')
                }
            );
            const rows = Array.isArray(response?.json) ? response.json : [];
            collected.push(
                ...rows
                    .map((entry: any) =>
                        normalizeId(
                            typeof entry === 'string' ? entry : entry?.id
                        )
                    )
                    .filter(Boolean)
            );
            if (rows.length < 100) {
                break;
            }
            offset += rows.length;
        }
        return collected;
    }

    async function loadMutualFriends() {
        if (!currentUserId || isMutualFetching) {
            return;
        }
        if (currentUserSnapshot?.hasSharedConnectionsOptOut) {
            toast.warning(
                t(
                    'view.friend_list.label.shared_connections_are_opted_out_for_the_current_account'
                )
            );
            return;
        }
        const friendSnapshot = rosterRows.filter((friend: any) =>
            normalizeId(friend?.id)
        );
        if (!friendSnapshot.length) {
            toast.info(
                t(
                    'view.friend_list.empty.no_friends_are_available_for_mutual_friends_loading'
                )
            );
            return;
        }
        const rateLimiter = createRateLimiter({
            limitPerInterval: 5,
            intervalMs: 1000
        });
        const entries = new Map();
        const metaEntries = new Map();
        setIsMutualFetching(true);
        setMutualProgress({
            current: 0,
            total: friendSnapshot.length
        });
        try {
            for (let index = 0; index < friendSnapshot.length; index += 1) {
                const friend = friendSnapshot[index];
                const friendId = normalizeId(friend?.id);
                try {
                    const mutualIds = await fetchMutualFriendIds(
                        friendId,
                        rateLimiter
                    );
                    entries.set(friendId, mutualIds);
                    metaEntries.set(friendId, {
                        optedOut: false
                    });
                    applyFriendPatch({
                        userId: friendId,
                        patch: {
                            $mutualCount: mutualIds.length,
                            $mutualOptedOut: false
                        },
                        stateBucket:
                            friend.stateBucket || friend.state || 'offline'
                    });
                } catch (error) {
                    if (error?.status === 403 || error?.status === 404) {
                        metaEntries.set(friendId, {
                            optedOut: true
                        });
                        applyFriendPatch({
                            userId: friendId,
                            patch: {
                                $mutualCount: 0,
                                $mutualOptedOut: true
                            },
                            stateBucket:
                                friend.stateBucket || friend.state || 'offline'
                        });
                    } else {
                        console.warn(
                            '[FriendListPage] Skipping mutual friend fetch',
                            friendId,
                            error
                        );
                    }
                } finally {
                    setMutualProgress({
                        current: index + 1,
                        total: friendSnapshot.length
                    });
                }
            }
            await mutualGraphPersistenceRepository.bulkUpsertMeta(
                currentUserId,
                metaEntries
            );
            await mutualGraphPersistenceRepository.saveSnapshot(
                currentUserId,
                entries
            );
            toast.success(t('view.friend_list.label.mutual_friends_loaded'));
        } finally {
            setIsMutualFetching(false);
        }
    }

    function openFriendDetails(friend: any) {
        openUserDialog({
            userId: friend?.id,
            title: friend?.displayName || friend?.username || undefined
        });
    }

    return {
        confirmDeleteFriend,
        isMutualFetching,
        bulkUnfriendSelected,
        loadFriendUserDetails,
        loadMutualFriends,
        openFriendDetails,
        resetFriendListTableLayout: resetTableLayout,
        toggleSelectedFriend
    };
}
