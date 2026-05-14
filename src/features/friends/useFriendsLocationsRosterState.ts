import { useFavoriteStore } from '@/state/favoriteStore';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useSessionStore } from '@/state/sessionStore';

export function useFriendsLocationsRosterState() {
    const isFavoritesLoaded = useSessionStore(
        (state: any) => state.isFavoritesLoaded
    );
    const rosterStatus = useFriendRosterStore((state: any) => state.loadStatus);
    const rosterDetail = useFriendRosterStore((state: any) => state.detail);
    const onlineIds = useFriendRosterStore((state: any) => state.onlineIds);
    const activeIds = useFriendRosterStore((state: any) => state.activeIds);
    const offlineIds = useFriendRosterStore((state: any) => state.offlineIds);
    const friendsById = useFriendRosterStore((state: any) => state.friendsById);
    const remoteFavoriteFriendIds = useFavoriteStore(
        (state: any) => state.favoriteFriendIds
    );
    const favoriteFriendGroups = useFavoriteStore(
        (state: any) => state.favoriteFriendGroups
    );
    const groupedFavoriteFriendIdsByGroupKey = useFavoriteStore(
        (state: any) => state.groupedFavoriteFriendIdsByGroupKey
    );
    const localFriendFavorites = useFavoriteStore(
        (state: any) => state.localFriendFavorites
    );
    const localFriendFavoriteGroups = useFavoriteStore(
        (state: any) => state.localFriendFavoriteGroups
    );

    return {
        activeIds,
        favoriteFriendGroups,
        friendsById,
        groupedFavoriteFriendIdsByGroupKey,
        isFavoritesLoaded,
        localFriendFavoriteGroups,
        localFriendFavorites,
        offlineIds,
        onlineIds,
        remoteFavoriteFriendIds,
        rosterDetail,
        rosterStatus
    };
}
