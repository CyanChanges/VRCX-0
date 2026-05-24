import { FEED_FILTER_TYPES, type FeedFilterType } from '@/repositories/feedRepository';

export type FeedViewMode = 'table' | 'columns';

export type FeedColumnFriendScope =
    | { kind: 'all' }
    | { kind: 'favorites'; groupKeys: 'all' | string[] };

export type FeedColumnConfig = {
    id: string;
    title: string;
    width: number;
    friendScope: FeedColumnFriendScope;
    feedTypes: FeedFilterType[];
};

const MIN_COLUMN_WIDTH = 280;
const MAX_COLUMN_WIDTH = 420;
const DEFAULT_COLUMN_WIDTH = 320;

const ALL_FEED_TYPES = [...FEED_FILTER_TYPES];

export const FEED_COLUMNS_DEFAULT_CONFIG: FeedColumnConfig[] = [
    {
        id: 'location',
        title: 'Location',
        width: DEFAULT_COLUMN_WIDTH,
        friendScope: { kind: 'all' },
        feedTypes: ['GPS']
    },
    {
        id: 'fav',
        title: 'Favorites',
        width: DEFAULT_COLUMN_WIDTH,
        friendScope: { kind: 'favorites', groupKeys: 'all' },
        feedTypes: ALL_FEED_TYPES
    },
    {
        id: 'profile',
        title: 'Profile',
        width: DEFAULT_COLUMN_WIDTH,
        friendScope: { kind: 'all' },
        feedTypes: ['Status', 'Avatar', 'Bio']
    },
    {
        id: 'presence',
        title: 'Presence',
        width: DEFAULT_COLUMN_WIDTH,
        friendScope: { kind: 'all' },
        feedTypes: ['Online', 'Offline']
    }
];

function normalizeString(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function createColumnId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `col_${crypto.randomUUID()}`;
    }
    return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function sanitizeWidth(value: unknown): number {
    const width = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(width)) {
        return DEFAULT_COLUMN_WIDTH;
    }
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width));
}

function sanitizeFeedTypes(value: unknown): FeedFilterType[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((type, index, source): type is FeedFilterType => {
        if (typeof type !== 'string') {
            return false;
        }
        if (!FEED_FILTER_TYPES.includes(type as FeedFilterType)) {
            return false;
        }
        return source.indexOf(type) === index;
    });
}

function sanitizeFriendScope(value: unknown): FeedColumnFriendScope {
    if (!value || typeof value !== 'object') {
        return { kind: 'all' };
    }
    const scope = value as Record<string, unknown>;
    if (scope.kind !== 'favorites') {
        return { kind: 'all' };
    }
    if (scope.groupKeys === 'all') {
        return { kind: 'favorites', groupKeys: 'all' };
    }
    if (!Array.isArray(scope.groupKeys)) {
        return { kind: 'favorites', groupKeys: 'all' };
    }
    const groupKeys = Array.from(
        new Set(
            scope.groupKeys.map(normalizeString).filter(Boolean)
        )
    );
    return {
        kind: 'favorites',
        groupKeys
    };
}

export function sanitizeFeedViewMode(value: unknown): FeedViewMode {
    return value === 'columns' ? 'columns' : 'table';
}

export function sanitizeFeedColumnConfig(value: unknown): FeedColumnConfig | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const column = value as Record<string, unknown>;
    const feedTypes = sanitizeFeedTypes(column.feedTypes);
    if (!feedTypes.length) {
        return null;
    }
    const id = normalizeString(column.id) || createColumnId();
    const title = normalizeString(column.title);
    if (!title) {
        return null;
    }
    return {
        id,
        title: id === 'fav' && title === 'Fav' ? 'Favorites' : title,
        width: sanitizeWidth(column.width),
        friendScope: sanitizeFriendScope(column.friendScope),
        feedTypes
    };
}

export function sanitizeFeedColumnsConfig(value: unknown): FeedColumnConfig[] {
    const columns = (Array.isArray(value) ? value : [])
        .map(sanitizeFeedColumnConfig)
        .filter(Boolean) as FeedColumnConfig[];
    return columns.length ? columns : createFeedColumnsPresetConfig();
}

export function createFeedColumnsPresetConfig(): FeedColumnConfig[] {
    return FEED_COLUMNS_DEFAULT_CONFIG.map((column) => ({
        ...column,
        feedTypes: [...column.feedTypes],
        friendScope:
            column.friendScope.kind === 'favorites' &&
            column.friendScope.groupKeys !== 'all'
                ? {
                      kind: 'favorites',
                      groupKeys: [...column.friendScope.groupKeys]
                  }
                : { ...column.friendScope }
    }));
}

export function createFeedColumnConfig(
    patch: Partial<FeedColumnConfig> = {}
): FeedColumnConfig {
    return {
        id: patch.id || createColumnId(),
        title: patch.title || 'New Column',
        width: sanitizeWidth(patch.width),
        friendScope: patch.friendScope || { kind: 'all' },
        feedTypes: sanitizeFeedTypes(patch.feedTypes).length
            ? sanitizeFeedTypes(patch.feedTypes)
            : ALL_FEED_TYPES
    };
}
