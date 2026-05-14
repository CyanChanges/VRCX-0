import { tauriClient } from '../platform/tauri/client';

async function clearCookies(): Promise<unknown> {
    return tauriClient.web.clearCookies();
}

async function getCookies(): Promise<unknown> {
    return tauriClient.web.getCookies();
}

async function setCookies(cookie: unknown): Promise<unknown> {
    return tauriClient.web.setCookies(cookie);
}

const webRepository = Object.freeze({
    clearCookies,
    getCookies,
    setCookies
});

export { clearCookies, getCookies, setCookies };
export default webRepository;
