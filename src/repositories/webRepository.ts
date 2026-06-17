import { commands } from '@/platform/tauri/bindings';

async function clearCookies(): Promise<unknown> {
    return commands.webClearCookies();
}

async function getCookies(): Promise<unknown> {
    return commands.webGetCookies();
}

async function setCookies(cookie: unknown): Promise<unknown> {
    return commands.webSetCookies(cookie as string);
}

const webRepository = Object.freeze({
    clearCookies,
    getCookies,
    setCookies
});

export { clearCookies, getCookies, setCookies };
export default webRepository;
