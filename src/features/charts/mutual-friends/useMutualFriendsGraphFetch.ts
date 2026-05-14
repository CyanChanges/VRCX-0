import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import mutualGraphPersistenceRepository from '@/repositories/mutualGraphPersistenceRepository';
import { createRateLimiter } from '@/shared/utils/throttle';

import { fetchMutualFriendIds } from './mutualFriendsSigmaGraph';

export function useMutualFriendsGraphFetch({
    currentUserId,
    currentUserIdRef,
    friendsById,
    orderedFriendIds,
    reloadSnapshot,
    setDetail,
    setStatus
}: any) {
    const { t } = useTranslation();
    const fetchCancelRef = useRef(false);
    const [fetchProgress, setFetchProgress] = useState<any>({
        isFetching: false,
        processedFriends: 0,
        totalFriends: 0,
        cancelRequested: false
    });

    useEffect(() => {
        fetchCancelRef.current = true;
    }, [currentUserId]);

    const progressPercent = useMemo(
        () =>
            fetchProgress.totalFriends
                ? Math.min(
                      100,
                      Math.round(
                          (fetchProgress.processedFriends /
                              fetchProgress.totalFriends) *
                              100
                      )
                  )
                : 0,
        [fetchProgress.processedFriends, fetchProgress.totalFriends]
    );

    async function handleFetchGraph() {
        if (!currentUserId || fetchProgress.isFetching) {
            return;
        }
        const ownerUserId = currentUserId;

        const friendSnapshot = orderedFriendIds
            .map((friendId: any) => friendsById[friendId])
            .filter((friend: any) => friend?.id);
        if (!friendSnapshot.length) {
            toast.info(
                t(
                    'view.charts.empty.no_friends_are_available_for_mutual_graph_fetching'
                )
            );
            return;
        }

        fetchCancelRef.current = false;
        setFetchProgress({
            isFetching: true,
            processedFriends: 0,
            totalFriends: friendSnapshot.length,
            cancelRequested: false
        });
        setDetail('Fetching mutual friends from VRChat.');

        const rateLimiter = createRateLimiter({
            limitPerInterval: 5,
            intervalMs: 1000
        });
        const entries = new Map();
        const metaEntries = new Map();
        let cancelled = false;

        try {
            for (let index = 0; index < friendSnapshot.length; index += 1) {
                const friend = friendSnapshot[index];
                if (!friend?.id) {
                    continue;
                }

                if (fetchCancelRef.current) {
                    cancelled = true;
                    break;
                }

                try {
                    const mutualIds = await fetchMutualFriendIds(friend.id, {
                        rateLimiter,
                        isCancelled: () => fetchCancelRef.current
                    });
                    if (fetchCancelRef.current) {
                        cancelled = true;
                        break;
                    }
                    entries.set(friend.id, mutualIds);
                    metaEntries.set(friend.id, {
                        optedOut: false
                    });
                } catch (error) {
                    if (
                        fetchCancelRef.current ||
                        String(error?.message || '') === 'cancelled'
                    ) {
                        cancelled = true;
                        break;
                    }
                    if (error?.status === 403 || error?.status === 404) {
                        metaEntries.set(friend.id, {
                            optedOut: true
                        });
                    } else {
                        console.warn(
                            '[MutualFriendsPage] Skipping mutual graph friend fetch',
                            friend.id,
                            error
                        );
                    }
                }

                setFetchProgress({
                    isFetching: true,
                    processedFriends: index + 1,
                    totalFriends: friendSnapshot.length,
                    cancelRequested: false
                });
            }

            if (cancelled) {
                toast.warning(
                    t(
                        'view.charts.label.mutual_graph_fetch_cancelled_the_cached_graph_was_not_replaced'
                    )
                );
                return;
            }

            if (currentUserIdRef.current !== ownerUserId) {
                return;
            }
            await mutualGraphPersistenceRepository.bulkUpsertMeta(
                ownerUserId,
                metaEntries
            );
            await mutualGraphPersistenceRepository.saveSnapshot(ownerUserId, entries);
            await reloadSnapshot(
                'Fetched and cached the mutual-friends graph.',
                ownerUserId
            );
            toast.success(
                t('view.charts.success.mutual_friends_graph_refreshed')
            );
        } catch (error) {
            setStatus('error');
            setDetail(
                error instanceof Error
                    ? error.message
                    : 'Failed to fetch mutual-friends graph.'
            );
            toast.error(
                error instanceof Error
                    ? error.message
                    : t(
                          'view.charts.toast.failed_to_fetch_mutual_friends_graph'
                      )
            );
        } finally {
            fetchCancelRef.current = false;
            setFetchProgress((current: any) => ({
                ...current,
                isFetching: false,
                cancelRequested: false
            }));
        }
    }

    function handleCancelFetch() {
        fetchCancelRef.current = true;
        setFetchProgress((current: any) => ({
            ...current,
            cancelRequested: true
        }));
    }

    return {
        fetchProgress,
        handleCancelFetch,
        handleFetchGraph,
        progressPercent
    };
}
