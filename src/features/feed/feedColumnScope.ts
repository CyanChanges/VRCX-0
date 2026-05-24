import type { FeedColumnConfig } from './feedColumnsState';
import { normalizeFeedId as normalizeId } from './feedRows';

export type FeedFavoriteGroupOption = {
    key: string;
    label: string;
};

export type FeedColumnScopeDescriptionOptions = {
    allFavoritesLabel: string;
    allFriendsLabel: string;
    groupCountLabel(count: number): string;
    typeLabel(type: string): string;
};

export function buildFeedColumnFavoriteIds({
    column,
    localFriendFavorites,
    remoteFavoritesById
}: {
    column: FeedColumnConfig;
    localFriendFavorites: Record<string, unknown>;
    remoteFavoritesById: Record<string, any>;
}) {
    const ids = new Set<string>();
    if (column.friendScope.kind !== 'favorites') {
        return ids;
    }
    const groupKeys = column.friendScope.groupKeys;
    const allGroups = groupKeys === 'all';
    const selectedGroups = new Set(
        allGroups
            ? []
            : groupKeys.map((key) =>
                  normalizeId(String(key).replace(/^local:/, ''))
              )
    );
    const acceptsGroup = (groupKey: unknown) => {
        if (allGroups) {
            return true;
        }
        const normalized = normalizeId(groupKey);
        return (
            selectedGroups.has(normalized) ||
            selectedGroups.has(normalizeId(String(normalized).replace(/^local:/, '')))
        );
    };

    for (const favorite of Object.values(remoteFavoritesById || {})) {
        if (favorite?.type !== 'friend' || !acceptsGroup(favorite?.$groupKey)) {
            continue;
        }
        const favoriteId = normalizeId(favorite?.favoriteId);
        if (favoriteId) {
            ids.add(favoriteId);
        }
    }

    for (const [groupName, groupIds] of Object.entries(
        localFriendFavorites || {}
    )) {
        if (!acceptsGroup(groupName)) {
            continue;
        }
        for (const userId of Array.isArray(groupIds) ? groupIds : []) {
            const normalizedId = normalizeId(userId);
            if (normalizedId) {
                ids.add(normalizedId);
            }
        }
    }

    return ids;
}

export function buildFeedFavoriteGroupOptions({
    favoriteFriendGroups,
    localFriendFavoriteGroups
}: {
    favoriteFriendGroups: any[];
    localFriendFavoriteGroups: unknown[];
}): FeedFavoriteGroupOption[] {
    const options = new Map<string, FeedFavoriteGroupOption>();
    for (const group of Array.isArray(favoriteFriendGroups)
        ? favoriteFriendGroups
        : []) {
        const key = normalizeId(group?.key || group?.name || group?.id);
        if (key) {
            options.set(key, {
                key,
                label: normalizeId(group?.displayName || group?.name || key) || key
            });
        }
    }
    for (const groupName of Array.isArray(localFriendFavoriteGroups)
        ? localFriendFavoriteGroups
        : []) {
        const label = normalizeId(groupName);
        if (label) {
            options.set(`local:${label}`, {
                key: `local:${label}`,
                label
            });
        }
    }
    return [...options.values()].sort((left, right) =>
        left.label.localeCompare(right.label)
    );
}

export function describeFeedColumnScope(
    column: FeedColumnConfig,
    options: FeedColumnScopeDescriptionOptions
) {
    const scope =
        column.friendScope.kind === 'favorites'
            ? column.friendScope.groupKeys === 'all'
                ? options.allFavoritesLabel
                : options.groupCountLabel(column.friendScope.groupKeys.length)
            : options.allFriendsLabel;
    return `${scope} · ${column.feedTypes.map(options.typeLabel).join(', ')}`;
}
