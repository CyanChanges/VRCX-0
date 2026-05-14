import { useEffect, useMemo, useState } from 'react';

import { useKnownUserFacts } from '@/domain/users/useKnownUser';
import avatarCacheRepository from '@/repositories/avatarCacheRepository';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useFriendRosterStore } from '@/state/friendRosterStore';

import { normalizeFavoriteEntityId as normalizeEntityId } from './favoritesItems';
import type { FavoriteKind } from './favoritesTypes';
import { useFavoriteRemoteDetails } from './useFavoriteRemoteDetails';

export function useFavoritesCollectionsState({
    currentEndpoint,
    currentUserId,
    kind
}: {
    currentEndpoint: string;
    currentUserId: string;
    kind: FavoriteKind;
}) {
    const favoriteLoadStatus = useFavoriteStore((state: any) => state.loadStatus);
    const favoriteDetail = useFavoriteStore((state: any) => state.detail);
    const favoritesSortOrder = useFavoriteStore(
        (state: any) => state.favoritesSortOrder
    );
    const remoteFavoritesById = useFavoriteStore(
        (state: any) => state.remoteFavoritesById
    );
    const favoriteFriendGroups = useFavoriteStore(
        (state: any) => state.favoriteFriendGroups
    );
    const favoriteWorldGroups = useFavoriteStore(
        (state: any) => state.favoriteWorldGroups
    );
    const favoriteAvatarGroups = useFavoriteStore(
        (state: any) => state.favoriteAvatarGroups
    );
    const groupedFavoriteFriendIdsByGroupKey = useFavoriteStore(
        (state: any) => state.groupedFavoriteFriendIdsByGroupKey
    );
    const localWorldFavorites = useFavoriteStore(
        (state: any) => state.localWorldFavorites
    );
    const localAvatarFavorites = useFavoriteStore(
        (state: any) => state.localAvatarFavorites
    );
    const localFriendFavorites = useFavoriteStore(
        (state: any) => state.localFriendFavorites
    );
    const localWorldFavoriteGroups = useFavoriteStore(
        (state: any) => state.localWorldFavoriteGroups
    );
    const localAvatarFavoriteGroups = useFavoriteStore(
        (state: any) => state.localAvatarFavoriteGroups
    );
    const localFriendFavoriteGroups = useFavoriteStore(
        (state: any) => state.localFriendFavoriteGroups
    );
    const localWorldDetailsById = useFavoriteStore(
        (state: any) => state.localWorldDetailsById
    );
    const localAvatarDetailsById = useFavoriteStore(
        (state: any) => state.localAvatarDetailsById
    );
    const favoriteWorldIds = useFavoriteStore(
        (state: any) => state.favoriteWorldIds
    );
    const favoriteAvatarIds = useFavoriteStore(
        (state: any) => state.favoriteAvatarIds
    );
    const friendsById = useFriendRosterStore((state: any) => state.friendsById);
    const [avatarHistoryLoading, setAvatarHistoryLoading] = useState(false);
    const [avatarHistory, setAvatarHistory] = useState<any[]>([]);
    const [remoteDetailsRefreshToken, setRemoteDetailsRefreshToken] =
        useState(0);
    const friendsMap = useMemo(
        () => new Map(Object.entries(friendsById || {})),
        [friendsById]
    );
    const favoriteFriendFactIds = useMemo(() => {
        if (kind !== 'friend') {
            return [];
        }
        const ids = new Set();
        for (const groupIds of Object.values(
            groupedFavoriteFriendIdsByGroupKey || {}
        )) {
            for (const friendId of Array.isArray(groupIds) ? groupIds : []) {
                const normalizedId = normalizeEntityId(friendId);
                if (normalizedId) {
                    ids.add(normalizedId);
                }
            }
        }
        for (const groupIds of Object.values(localFriendFavorites || {})) {
            for (const friendId of Array.isArray(groupIds) ? groupIds : []) {
                const normalizedId = normalizeEntityId(friendId);
                if (normalizedId) {
                    ids.add(normalizedId);
                }
            }
        }
        return Array.from(ids);
    }, [groupedFavoriteFriendIdsByGroupKey, kind, localFriendFavorites]);
    const knownFavoriteUsersById = useKnownUserFacts(favoriteFriendFactIds, {
        endpoint: currentEndpoint
    });
    const avatarTags = useMemo(
        () =>
            kind === 'avatar'
                ? Array.from(
                      new Set(
                          Object.values(remoteFavoritesById)
                              .filter((favorite: any) => favorite?.type === 'avatar')
                              .map((favorite: any) =>
                                  typeof favorite?.tags?.[0] === 'string'
                                      ? favorite.tags[0].trim()
                                      : ''
                              )
                              .filter(Boolean)
                      )
                  )
                : [],
        [kind, remoteFavoritesById]
    );
    const remoteEntityDetails = useFavoriteRemoteDetails({
        type: kind === 'avatar' ? 'avatar' : 'world',
        favoriteIds:
            kind === 'world'
                ? favoriteWorldIds
                : kind === 'avatar'
                  ? favoriteAvatarIds
                  : [],
        avatarTags,
        refreshToken: remoteDetailsRefreshToken,
        enabled:
            kind !== 'friend' &&
            favoriteLoadStatus === 'ready' &&
            (kind === 'world'
                ? favoriteWorldIds.length > 0
                : favoriteAvatarIds.length > 0)
    });

    useEffect(() => {
        let active = true;
        if (kind !== 'avatar' || !currentUserId) {
            setAvatarHistory([]);
            return () => {
                active = false;
            };
        }
        setAvatarHistoryLoading(true);
        avatarCacheRepository
            .getAvatarHistory(currentUserId, 100)
            .then((rows: any) => {
                if (active) {
                    setAvatarHistory(Array.isArray(rows) ? rows : []);
                }
            })
            .catch(() => {
                if (active) {
                    setAvatarHistory([]);
                }
            })
            .finally(() => {
                if (active) {
                    setAvatarHistoryLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [currentUserId, kind]);

    function refreshRemoteDetails() {
        setRemoteDetailsRefreshToken((value) => value + 1);
    }

    return {
        avatarHistory,
        avatarHistoryLoading,
        favoriteAvatarGroups,
        favoriteDetail,
        favoriteFriendGroups,
        favoriteLoadStatus,
        favoritesSortOrder,
        favoriteWorldGroups,
        friendsById,
        friendsMap,
        groupedFavoriteFriendIdsByGroupKey,
        knownFavoriteUsersById,
        localAvatarDetailsById,
        localAvatarFavoriteGroups,
        localAvatarFavorites,
        localFriendFavoriteGroups,
        localFriendFavorites,
        localWorldDetailsById,
        localWorldFavoriteGroups,
        localWorldFavorites,
        refreshRemoteDetails,
        remoteEntityDetails,
        remoteFavoritesById,
        setAvatarHistory,
        setAvatarHistoryLoading
    };
}
