import { tauriClient } from '@/platform/tauri/client';

type ExternalHeaders = Record<string, string>;

interface ExternalRequestInput {
    url: string;
    method?: string;
    headers?: ExternalHeaders;
    body?: unknown;
}

function normalizeString(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

async function searchAvatarProvider({
    url,
    vrcxId
}: {
    url: string;
    vrcxId: string;
}) {
    return tauriClient.app.ExternalApiAvatarSearchGet({ url, vrcxId });
}

async function executeTranslationRequest({
    url,
    method = 'GET',
    headers = {},
    body = null
}: ExternalRequestInput) {
    return tauriClient.app.ExternalApiTranslationRequest({
        url,
        method,
        headers,
        body
    });
}

async function fetchYoutubeVideoMetadata({
    videoId,
    apiKey
}: {
    videoId: unknown;
    apiKey: unknown;
}) {
    const normalizedVideoId = normalizeString(videoId);
    const normalizedApiKey = normalizeString(apiKey);
    return tauriClient.app.ExternalApiYoutubeVideoMetadataGet({
        videoId: normalizedVideoId,
        apiKey: normalizedApiKey
    });
}

async function fetchVrcStatusJson(path: string) {
    return tauriClient.app.ExternalApiVrcStatusJsonGet({ path });
}

async function fetchGithubReleases({
    url,
    headers = {}
}: {
    url: string;
    headers?: ExternalHeaders;
}) {
    return tauriClient.app.ExternalApiGithubReleasesGet({
        url,
        headers
    });
}

async function fetchImageDataUrl(url: string) {
    return tauriClient.app.ExternalApiImageDataUrlGet({ url });
}

const externalApiRepository = Object.freeze({
    searchAvatarProvider,
    executeTranslationRequest,
    fetchYoutubeVideoMetadata,
    fetchVrcStatusJson,
    fetchGithubReleases,
    fetchImageDataUrl
});

export {
    executeTranslationRequest,
    fetchGithubReleases,
    fetchImageDataUrl,
    fetchVrcStatusJson,
    fetchYoutubeVideoMetadata,
    searchAvatarProvider
};
export default externalApiRepository;
