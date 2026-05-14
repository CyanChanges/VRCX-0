import { useEffect, useState } from 'react';

import type { FavoriteKind } from './favoritesTypes';
import { useFavoritesActions } from './useFavoritesActions';
import { useFavoritesCollectionsState } from './useFavoritesCollectionsState';
import {
    useFavoritesFilters,
    useFavoritesSelectedGroupSync
} from './useFavoritesFilters';
import { useFavoritesLayoutPreferences } from './useFavoritesLayoutPreferences';
import { useFavoritesRuntime } from './useFavoritesRuntime';
import { useFavoritesSelectionState } from './useFavoritesSelectionState';
import { useFavoritesViewData } from './useFavoritesViewData';

export function useFavoritesPageController({ kind }: { kind: FavoriteKind }) {
    const filters = useFavoritesFilters({ kind });
    const runtime = useFavoritesRuntime();
    const collections = useFavoritesCollectionsState({
        currentEndpoint: runtime.currentEndpoint,
        currentUserId: runtime.currentUserId,
        kind
    });
    const layout = useFavoritesLayoutPreferences(kind);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [creatingLocalGroup, setCreatingLocalGroup] = useState(false);
    const [newLocalGroupName, setNewLocalGroupName] = useState('');
    const viewData = useFavoritesViewData({
        avatarHistory: collections.avatarHistory,
        currentUserSnapshot: runtime.currentUserSnapshot,
        favoriteAvatarGroups: collections.favoriteAvatarGroups,
        favoriteFriendGroups: collections.favoriteFriendGroups,
        favoriteWorldGroups: collections.favoriteWorldGroups,
        favoritesSortOrder: collections.favoritesSortOrder,
        friendsById: collections.friendsById,
        groupedFavoriteFriendIdsByGroupKey:
            collections.groupedFavoriteFriendIdsByGroupKey,
        knownUsersById: collections.knownFavoriteUsersById,
        kind,
        localAvatarDetailsById: collections.localAvatarDetailsById,
        localAvatarFavoriteGroups: collections.localAvatarFavoriteGroups,
        localAvatarFavorites: collections.localAvatarFavorites,
        localFriendFavoriteGroups: collections.localFriendFavoriteGroups,
        localFriendFavorites: collections.localFriendFavorites,
        localWorldDetailsById: collections.localWorldDetailsById,
        localWorldFavoriteGroups: collections.localWorldFavoriteGroups,
        localWorldFavorites: collections.localWorldFavorites,
        remoteEntityDetails: collections.remoteEntityDetails,
        remoteFavoritesById: collections.remoteFavoritesById,
        searchMode: filters.searchMode,
        searchQuery: filters.searchQuery,
        selectedGroupKey: filters.selectedGroupKey,
        selectedSource: filters.selectedSource,
        sortValue: layout.sortValue
    });
    const selection = useFavoritesSelectionState({
        contentItems: viewData.contentItems,
        isSearchActive: viewData.isSearchActive,
        kind,
        selectedSource: filters.selectedSource
    });
    const actions = useFavoritesActions({
        allItems: viewData.allItems,
        avatarHistoryLoading: collections.avatarHistoryLoading,
        canInviteFromCurrentLocation: runtime.canInviteFromCurrentLocation,
        currentEndpoint: runtime.currentEndpoint,
        currentInviteLocation: runtime.currentInviteLocation,
        currentUserId: runtime.currentUserId,
        currentUserSnapshot: runtime.currentUserSnapshot,
        friendsById: collections.friendsById,
        friendsMap: collections.friendsMap,
        kind,
        localGroups: viewData.localGroups,
        newLocalGroupName,
        refreshRemoteDetails: collections.refreshRemoteDetails,
        selectedContentItems: selection.selectedContentItems,
        selectedGroupKey: filters.selectedGroupKey,
        selectedSource: filters.selectedSource,
        setAvatarHistory: collections.setAvatarHistory,
        setAvatarHistoryLoading: collections.setAvatarHistoryLoading,
        setCreatingLocalGroup,
        setEditMode: selection.setEditMode,
        setExportDialogOpen,
        setNewLocalGroupName,
        setSelectedGroupKey: filters.setSelectedGroupKey,
        setSelectedKeys: selection.setSelectedKeys,
        setSelectedSource: filters.setSelectedSource
    });

    useFavoritesSelectedGroupSync({
        avatarHistoryGroups: viewData.avatarHistoryGroups,
        localGroups: viewData.localGroups,
        remoteGroups: viewData.remoteGroups,
        selectedGroupKey: filters.selectedGroupKey,
        selectedSource: filters.selectedSource,
        setSelectedGroupKey: filters.setSelectedGroupKey,
        setSelectedSource: filters.setSelectedSource
    });

    useEffect(() => {
        setExportDialogOpen(false);
        setCreatingLocalGroup(false);
        setNewLocalGroupName('');
    }, [kind]);

    return {
        actions,
        collections,
        creatingLocalGroup,
        exportDialogOpen,
        filters,
        kind,
        layout,
        newLocalGroupName,
        runtime,
        selection,
        setCreatingLocalGroup,
        setExportDialogOpen,
        setNewLocalGroupName,
        viewData
    };
}
