import {
    entityQueryPolicies,
    fetchCachedData,
    queryKeys
} from '@/lib/entityQueryCache';
import { normalizeVrchatEndpointDomain } from '@/shared/vrchatEndpoint';

import { normalizePlatformError } from '../platform/tauri/errors';
import { tauriClient } from '../platform/tauri/client';
import {
    parseJsonResponse,
    type QueryParams,
    type QueryValue,
    type VrchatRequestResponse,
    unwrapErrorMessage
} from './vrchatRequest';

type MediaApiRecord = Record<string, unknown>;
type MediaApiParams = QueryParams;

interface MediaApiOptions {
    endpoint?: string;
    force?: boolean;
}

interface MediaUploadResponse {
    json: MediaApiRecord;
    params: MediaApiParams;
    status?: number;
    raw?: unknown;
}

interface LegacyImageUploadOptions {
    avatarId?: unknown;
    worldId?: unknown;
    imageUrl?: string;
    base64File: string;
    blob?: Blob | { size?: number } | null;
    endpoint?: string;
}

interface MediaAssetUploadOptions extends MediaApiOptions {
    assetKind: string;
    cropWhiteBorder?: boolean;
    params?: MediaApiParams;
}

function normalizeParams(params: unknown = {}): MediaApiParams {
    if (!params || typeof params !== 'object') {
        return {};
    }
    return { ...(params as Record<string, QueryValue | QueryValue[]>) };
}

function resolveMediaEndpoint(endpoint: unknown = '') {
    return normalizeVrchatEndpointDomain(endpoint, {
        allowDebugEndpoint: true
    });
}

function unwrapMediaResponse(
    response: { status: number; data: unknown; raw: unknown },
    {
        params = {},
        extra = {},
        fallbackMessage = 'Media request failed'
    }: {
        params?: MediaApiParams;
        extra?: MediaApiRecord;
        fallbackMessage?: string;
    } = {}
): VrchatRequestResponse<MediaApiRecord> {
    const json = parseJsonResponse(response.data) as MediaApiRecord;
    if (
        response.status >= 400 ||
        (json && typeof json === 'object' && 'error' in json)
    ) {
        throw new Error(
            unwrapErrorMessage(json, response.status, {
                fallbackMessage
            })
        );
    }

    return {
        json,
        params,
        ...extra,
        status: response.status,
        raw: response.raw
    };
}

async function executeMediaCommand(
    command: () => Promise<{ status: number; data: unknown; raw: unknown }>,
    options: {
        params?: MediaApiParams;
        extra?: MediaApiRecord;
        fallbackMessage?: string;
    } = {}
): Promise<VrchatRequestResponse<MediaApiRecord>> {
    try {
        return unwrapMediaResponse(await command(), options);
    } catch (error) {
        throw normalizePlatformError(
            error,
            options.fallbackMessage ?? 'Media request failed'
        );
    }
}

function resolveLegacyBlobSize(blob: LegacyImageUploadOptions['blob']) {
    const size = Number(blob?.size);
    return Number.isFinite(size) && size > 0 ? size : undefined;
}

async function getFiles(
    params: MediaApiParams = {},
    options: MediaApiOptions = {}
) {
    const normalizedParams = normalizeParams(params);
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaFilesGet({
                endpoint: resolveMediaEndpoint(options.endpoint),
                params: normalizedParams
            }),
        {
            params: normalizedParams
        }
    );
}

async function getFileList(
    params: MediaApiParams = {},
    options: MediaApiOptions = {}
) {
    return getFiles(params, options);
}

async function deleteFile(fileId: unknown, options: MediaApiOptions = {}) {
    const normalizedFileId =
        typeof fileId === 'string'
            ? fileId.trim()
            : String(fileId ?? '').trim();
    if (!normalizedFileId) {
        throw new Error('MediaRepository.deleteFile requires a file id.');
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaFileDelete({
                endpoint: resolveMediaEndpoint(options.endpoint),
                fileId: normalizedFileId
            }),
        {
            extra: {
                fileId: normalizedFileId
            }
        }
    );
}

async function uploadGalleryImage(
    imageData: string,
    options: MediaApiOptions = {}
) {
    const params: MediaApiParams = {
        tag: 'gallery'
    };
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaGalleryImageUpload({
                endpoint: resolveMediaEndpoint(options.endpoint),
                imageData
            }),
        {
            params
        }
    );
}

async function uploadAvatarGalleryImage(
    imageData: string,
    avatarId: QueryValue,
    options: MediaApiOptions = {}
) {
    const params: MediaApiParams = {
        tag: 'avatargallery',
        galleryId: avatarId
    };
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaAvatarGalleryImageUpload({
                endpoint: resolveMediaEndpoint(options.endpoint),
                imageData,
                avatarId
            }),
        {
            params
        }
    );
}

async function uploadVrcPlusIcon(
    imageData: string,
    options: MediaApiOptions = {}
) {
    const params: MediaApiParams = {
        tag: 'icon'
    };
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaVrcPlusIconUpload({
                endpoint: resolveMediaEndpoint(options.endpoint),
                imageData
            }),
        {
            params
        }
    );
}

async function uploadEmoji(
    imageData: string,
    params: MediaApiParams = {},
    options: MediaApiOptions = {}
) {
    const normalizedParams = normalizeParams(params);
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaEmojiUpload({
                endpoint: resolveMediaEndpoint(options.endpoint),
                imageData,
                params: normalizedParams
            }),
        {
            params: normalizedParams
        }
    );
}

async function uploadSticker(imageData: string, options: MediaApiOptions = {}) {
    const params: MediaApiParams = {
        tag: 'sticker',
        maskTag: 'square'
    };
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaStickerUpload({
                endpoint: resolveMediaEndpoint(options.endpoint),
                imageData
            }),
        {
            params
        }
    );
}

async function uploadPrint(
    imageData: string,
    {
        endpoint = '',
        cropWhiteBorder = true,
        params = {}
    }: {
        endpoint?: string;
        cropWhiteBorder?: boolean;
        params?: MediaApiParams;
    } = {}
): Promise<MediaUploadResponse> {
    const normalizedParams = normalizeParams(params);
    const response = await executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaPrintUpload({
                endpoint: resolveMediaEndpoint(endpoint),
                imageData,
                cropWhiteBorder: Boolean(cropWhiteBorder),
                params: normalizedParams
            }),
        {
            params: normalizedParams,
            fallbackMessage: 'Print upload failed'
        }
    );
    return {
        ...response,
        params: response.params ?? normalizedParams
    };
}

async function uploadAssetImage(
    imageData: string,
    {
        endpoint = '',
        assetKind,
        cropWhiteBorder = false,
        params = {}
    }: MediaAssetUploadOptions
): Promise<MediaUploadResponse> {
    const normalizedParams = normalizeParams(params);
    const response = await executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaAssetUpload({
                endpoint: resolveMediaEndpoint(endpoint),
                assetKind,
                imageData,
                cropWhiteBorder: Boolean(cropWhiteBorder),
                params: normalizedParams
            }),
        {
            params: normalizedParams,
            fallbackMessage: 'Media asset upload failed'
        }
    );
    return {
        ...response,
        params: response.params ?? normalizedParams
    };
}

async function getPrints(
    { userId, n = 100 }: { userId?: unknown; n?: number } = {},
    options: MediaApiOptions = {}
) {
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();
    if (!normalizedUserId) {
        throw new Error('MediaRepository.getPrints requires a user id.');
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaPrintsGet({
                endpoint: resolveMediaEndpoint(options.endpoint),
                userId: normalizedUserId,
                n
            }),
        {
            params: {
                n
            },
            extra: {
                userId: normalizedUserId
            }
        }
    );
}

async function getPrint(printId: unknown, options: MediaApiOptions = {}) {
    const normalizedPrintId =
        typeof printId === 'string'
            ? printId.trim()
            : String(printId ?? '').trim();
    if (!normalizedPrintId) {
        throw new Error('MediaRepository.getPrint requires a print id.');
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaPrintGet({
                endpoint: resolveMediaEndpoint(options.endpoint),
                printId: normalizedPrintId
            }),
        {
            extra: {
                printId: normalizedPrintId
            }
        }
    );
}

async function deletePrint(printId: unknown, options: MediaApiOptions = {}) {
    const normalizedPrintId =
        typeof printId === 'string'
            ? printId.trim()
            : String(printId ?? '').trim();
    if (!normalizedPrintId) {
        throw new Error('MediaRepository.deletePrint requires a print id.');
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaPrintDelete({
                endpoint: resolveMediaEndpoint(options.endpoint),
                printId: normalizedPrintId
            }),
        {
            extra: {
                printId: normalizedPrintId
            }
        }
    );
}

async function getInventoryItems(
    params: MediaApiParams = {},
    options: MediaApiOptions = {}
) {
    const normalizedParams = normalizeParams(params);
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaInventoryItemsGet({
                endpoint: resolveMediaEndpoint(options.endpoint),
                params: normalizedParams
            }),
        {
            params: normalizedParams
        }
    );
}

async function getUserInventoryItem(
    { inventoryId, userId }: { inventoryId?: unknown; userId?: unknown } = {},
    options: MediaApiOptions = {}
) {
    const normalizedInventoryId =
        typeof inventoryId === 'string'
            ? inventoryId.trim()
            : String(inventoryId ?? '').trim();
    const normalizedUserId =
        typeof userId === 'string'
            ? userId.trim()
            : String(userId ?? '').trim();
    if (!normalizedInventoryId || !normalizedUserId) {
        throw new Error(
            'MediaRepository.getUserInventoryItem requires inventory and user ids.'
        );
    }

    return fetchCachedData({
        queryKey: queryKeys.userInventoryItem(
            {
                inventoryId: normalizedInventoryId,
                userId: normalizedUserId
            },
            options.endpoint
        ),
        policy: entityQueryPolicies.inventoryCollection,
        force: Boolean(options.force),
        queryFn: () =>
            executeMediaCommand(
                () =>
                    tauriClient.app.VrchatMediaUserInventoryItemGet({
                        endpoint: resolveMediaEndpoint(options.endpoint),
                        userId: normalizedUserId,
                        inventoryId: normalizedInventoryId
                    }),
                {
                    extra: {
                        inventoryId: normalizedInventoryId,
                        userId: normalizedUserId
                    }
                }
            )
    });
}

async function updateInventoryItem(
    inventoryId: unknown,
    params: MediaApiParams = {},
    options: MediaApiOptions = {}
) {
    const normalizedInventoryId =
        typeof inventoryId === 'string'
            ? inventoryId.trim()
            : String(inventoryId ?? '').trim();
    if (!normalizedInventoryId) {
        throw new Error(
            'MediaRepository.updateInventoryItem requires an inventory id.'
        );
    }

    const normalizedParams = normalizeParams(params);
    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaInventoryItemUpdate({
                endpoint: resolveMediaEndpoint(options.endpoint),
                inventoryId: normalizedInventoryId,
                params: normalizedParams
            }),
        {
            params: normalizedParams
        }
    );
}

async function consumeInventoryBundle(
    inventoryId: unknown,
    options: MediaApiOptions = {}
) {
    const normalizedInventoryId =
        typeof inventoryId === 'string'
            ? inventoryId.trim()
            : String(inventoryId ?? '').trim();
    if (!normalizedInventoryId) {
        throw new Error(
            'MediaRepository.consumeInventoryBundle requires an inventory id.'
        );
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaInventoryBundleConsume({
                endpoint: resolveMediaEndpoint(options.endpoint),
                inventoryId: normalizedInventoryId
            }),
        {
            params: {
                inventoryId: normalizedInventoryId
            }
        }
    );
}

async function redeemReward(code: unknown, options: MediaApiOptions = {}) {
    const normalizedCode =
        typeof code === 'string' ? code.trim() : String(code ?? '').trim();
    if (!normalizedCode) {
        throw new Error('MediaRepository.redeemReward requires a reward code.');
    }

    return executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaRewardRedeem({
                endpoint: resolveMediaEndpoint(options.endpoint),
                code: normalizedCode
            }),
        {
            params: {
                code: normalizedCode
            }
        }
    );
}

async function uploadAvatarImageLegacy({
    avatarId,
    imageUrl = '',
    base64File,
    blob,
    endpoint = ''
}: LegacyImageUploadOptions) {
    const normalizedAvatarId =
        typeof avatarId === 'string'
            ? avatarId.trim()
            : String(avatarId ?? '').trim();
    if (!normalizedAvatarId) {
        throw new Error(
            'MediaRepository.uploadAvatarImageLegacy requires an avatar id.'
        );
    }

    const response = await executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaAvatarImageUploadLegacy({
                endpoint: resolveMediaEndpoint(endpoint),
                entityId: normalizedAvatarId,
                imageUrl,
                base64File,
                fileSizeInBytes: resolveLegacyBlobSize(blob)
            }),
        {
            fallbackMessage: 'Avatar image upload failed'
        }
    );

    return {
        avatar: response.json?.avatar,
        imageUrl: response.json?.imageUrl,
        fileId: response.json?.fileId,
        fileVersion: response.json?.fileVersion
    };
}

async function uploadWorldImageLegacy({
    worldId,
    imageUrl = '',
    base64File,
    blob,
    endpoint = ''
}: LegacyImageUploadOptions) {
    const normalizedWorldId =
        typeof worldId === 'string'
            ? worldId.trim()
            : String(worldId ?? '').trim();
    if (!normalizedWorldId) {
        throw new Error(
            'MediaRepository.uploadWorldImageLegacy requires a world id.'
        );
    }

    const response = await executeMediaCommand(
        () =>
            tauriClient.app.VrchatMediaWorldImageUploadLegacy({
                endpoint: resolveMediaEndpoint(endpoint),
                entityId: normalizedWorldId,
                imageUrl,
                base64File,
                fileSizeInBytes: resolveLegacyBlobSize(blob)
            }),
        {
            fallbackMessage: 'World image upload failed'
        }
    );

    return {
        world: response.json?.world,
        imageUrl: response.json?.imageUrl,
        fileId: response.json?.fileId,
        fileVersion: response.json?.fileVersion
    };
}

const vrchatMediaRepository = Object.freeze({
    getFiles,
    getFileList,
    deleteFile,
    uploadGalleryImage,
    uploadAvatarGalleryImage,
    uploadVrcPlusIcon,
    uploadEmoji,
    uploadSticker,
    uploadPrint,
    uploadAssetImage,
    getPrints,
    getPrint,
    deletePrint,
    getInventoryItems,
    getUserInventoryItem,
    updateInventoryItem,
    consumeInventoryBundle,
    redeemReward,
    uploadAvatarImageLegacy,
    uploadWorldImageLegacy
});

export {
    getFiles,
    getFileList,
    deleteFile,
    uploadGalleryImage,
    uploadAvatarGalleryImage,
    uploadVrcPlusIcon,
    uploadEmoji,
    uploadSticker,
    uploadPrint,
    uploadAssetImage,
    getPrints,
    getPrint,
    deletePrint,
    getInventoryItems,
    getUserInventoryItem,
    updateInventoryItem,
    consumeInventoryBundle,
    redeemReward,
    uploadAvatarImageLegacy,
    uploadWorldImageLegacy
};

export default vrchatMediaRepository;
