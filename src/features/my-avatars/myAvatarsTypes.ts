export type MyAvatarsLoadStatus = 'idle' | 'running' | 'ready' | 'error';

export type MyAvatarsViewMode = 'grid' | 'table';

export type MyAvatarsGridDensity = 'standard' | 'compact' | 'dense';

export type MyAvatarsAuthTarget = {
    currentUserId: string;
    currentEndpoint: string;
};

export type MyAvatarTag = {
    tag: string;
    [key: string]: any;
};

export type MyAvatarRow = {
    id?: string;
    name?: string;
    releaseStatus?: string;
    thumbnailImageUrl?: string;
    imageUrl?: string;
    unityPackages?: any[];
    version?: number;
    updated_at?: string;
    created_at?: string;
    $tags?: MyAvatarTag[];
    $timeSpent?: number;
    [key: string]: any;
};

export type MyAvatarAction =
    | 'details'
    | 'wear'
    | 'manageTags'
    | 'editDetails'
    | 'makePrivate'
    | 'makePublic'
    | 'changeContentTags'
    | 'changeImage'
    | 'createImpostor';

export type MyAvatarActionHandler = (
    action: MyAvatarAction,
    avatar: MyAvatarRow
) => void | Promise<void>;

export type MyAvatarImageCropRequest = {
    file: File;
    avatar: MyAvatarRow;
    authTarget: MyAvatarsAuthTarget;
};

export type MyAvatarsGridDensityConfig = {
    value: MyAvatarsGridDensity;
    gridGap: number;
    gridMinWidth: number;
    imageHeightRatio: number;
    overlayPaddingX: number;
    overlayPaddingY: number;
    overlayPaddingTop: number;
    overlayNameOnlyPaddingTop: number;
    overlayGap: number;
    nameFontSize: number;
    nameLineHeight: number;
    tagFontSize: number;
    maxVisibleTags: number;
    rowPaddingY: number;
};

export type MyAvatarsGridRow = {
    key: string;
    top: number;
    height: number;
    avatars: MyAvatarRow[];
};
