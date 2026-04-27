import { buildCurrentUserPresenceView } from '@/shared/utils/currentUserPresence.js';

import {
    normalizeId,
    resolveCurrentUserStateBucket
} from './friendsSidebarModel.js';

function pushSection(nextRows, { id, title, count, open, children = [] }) {
    nextRows.push({
        type: 'section',
        key: `section:${id}`,
        id,
        title,
        count,
        open,
        children
    });
}

function pushFriendRows(
    nextRows,
    sectionKey,
    sectionRows,
    { currentUserId, isCurrentUser = false, isGroupByInstance = false } = {}
) {
    for (const friend of sectionRows) {
        const friendId = normalizeId(friend?.id);
        nextRows.push({
            type: 'friend',
            key: `friend:${sectionKey}:${friendId}`,
            friend,
            isCurrentUser: Boolean(
                isCurrentUser || friendId === normalizeId(currentUserId)
            ),
            isGroupByInstance: Boolean(isGroupByInstance)
        });
    }
}

function buildFriendRows(sectionKey, sectionRows, options) {
    const nextRows = [];
    pushFriendRows(nextRows, sectionKey, sectionRows, options);
    return nextRows;
}

function pushSkeletonRows(nextRows, key, count = 6) {
    for (let index = 0; index < count; index += 1) {
        nextRows.push({
            type: 'skeleton',
            key: `skeleton:${key}:${index}`
        });
    }
}

function buildFavoriteRows({
    currentUserId,
    favoriteGroupSections,
    favoriteRows,
    prefs
}) {
    const nextRows = [];

    if (!prefs.isSidebarDivideByFriendGroup) {
        pushFriendRows(nextRows, 'favorites', favoriteRows, { currentUserId });
        return nextRows;
    }
    for (const section of favoriteGroupSections) {
        nextRows.push({
            type: 'favorite-group-header',
            key: `favorite-group:${section.key}`,
            label: section.label,
            count: section.rows.length
        });
        pushFriendRows(nextRows, `favorites:${section.key}`, section.rows, {
            currentUserId
        });
    }

    return nextRows;
}

function buildCurrentUserRows({ currentUser, currentUserId, gameState, prefs }) {
    if (!currentUser) {
        return Array.from({ length: 1 }, (_, index) => ({
            type: 'skeleton',
            key: `skeleton:me:${index}`
        }));
    }

    const currentUserRow = buildCurrentUserPresenceView(currentUser, {
        gameState,
        gameLogDisabled: Boolean(prefs.gameLogDisabled)
    });

    return buildFriendRows(
        'me',
        [
            {
                ...currentUserRow,
                stateBucket: resolveCurrentUserStateBucket(currentUserRow)
            }
        ],
        { currentUserId, isCurrentUser: true }
    );
}

export function buildFriendsSidebarVirtualRows({
    activeRows,
    currentUser,
    currentUserId,
    favoriteGroupSections,
    favoriteRows,
    gameState,
    loadStatus,
    offlineRows,
    onlineRows,
    openGroups,
    prefs,
    rowsLength,
    sameInstanceGroups,
    t
}) {
    const nextRows = [];

    if (loadStatus === 'running' && !rowsLength) {
        pushSkeletonRows(nextRows, 'loading');
        nextRows.push({ type: 'footer', key: 'footer' });
        return nextRows;
    }

    pushSection(nextRows, {
        id: 'me',
        title: t('side_panel.me'),
        open: openGroups.me,
        children: openGroups.me
            ? buildCurrentUserRows({
                  currentUser,
                  currentUserId,
                  gameState,
                  prefs
              })
            : []
    });

    const pushSameInstance = () => {
        if (!sameInstanceGroups.length) {
            return;
        }
        const children = [];
        if (openGroups.sameInstance) {
            sameInstanceGroups.forEach((group, index) => {
                children.push({
                    type: 'instance-header',
                    key: `instance:${group.location}:${index}`,
                    location: group.location,
                    count: group.rows.length
                });
                pushFriendRows(
                    children,
                    `sameInstance:${group.location}:${index}`,
                    group.rows,
                    { currentUserId, isGroupByInstance: true }
                );
            });
        }
        pushSection(nextRows, {
            id: 'sameInstance',
            title: t('side_panel.same_instance'),
            count: sameInstanceGroups.length,
            open: openGroups.sameInstance,
            children
        });
    };
    const pushFavorites = () => {
        if (!favoriteRows.length) {
            return;
        }
        pushSection(nextRows, {
            id: 'favorites',
            title: t('side_panel.favorite'),
            count: favoriteRows.length,
            open: openGroups.favorites,
            children: openGroups.favorites
                ? buildFavoriteRows({
                      currentUserId,
                      favoriteGroupSections,
                      favoriteRows,
                      prefs
                  })
                : []
        });
    };

    if (prefs.isSameInstanceAboveFavorites) {
        pushSameInstance();
        pushFavorites();
    } else {
        pushFavorites();
        pushSameInstance();
    }

    pushSection(nextRows, {
        id: 'online',
        title: t('side_panel.online'),
        count: onlineRows.length,
        open: openGroups.online,
        children: openGroups.online
            ? buildFriendRows('online', onlineRows, { currentUserId })
            : []
    });

    pushSection(nextRows, {
        id: 'active',
        title: t('side_panel.active'),
        count: activeRows.length,
        open: openGroups.active,
        children: openGroups.active
            ? buildFriendRows('active', activeRows, { currentUserId })
            : []
    });

    pushSection(nextRows, {
        id: 'offline',
        title: t('side_panel.offline'),
        count: offlineRows.length,
        open: openGroups.offline,
        children: openGroups.offline
            ? buildFriendRows('offline', offlineRows, { currentUserId })
            : []
    });

    if (!rowsLength && loadStatus !== 'running') {
        pushSkeletonRows(nextRows, 'empty', 4);
    }

    nextRows.push({ type: 'footer', key: 'footer' });
    return nextRows;
}
