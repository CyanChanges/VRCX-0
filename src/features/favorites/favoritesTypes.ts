export type FavoriteKind = 'friend' | 'world' | 'avatar';

export type FavoriteSource = 'remote' | 'local' | 'history';

export type FavoriteGroup = {
    key: string;
    source: FavoriteSource;
    label: string;
    name?: string;
    count?: number;
    capacity?: number;
    visibility?: string;
};

export type FavoriteItem = {
    key: string;
    id: string;
    kind: FavoriteKind;
    source: FavoriteSource;
    groupKey?: string;
    groupLabel?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    seedData?: any;
    isUnavailable?: boolean;
    isPrivate?: boolean;
    tags?: string[];
    titleColor?: string;
    travelingToLocation?: string;
};
