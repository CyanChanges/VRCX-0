import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform/tauri/client', () => ({
    tauriClient: {
        web: {
            clearCookies: vi.fn(),
            getCookies: vi.fn(),
            setCookies: vi.fn()
        }
    }
}));

import { tauriClient } from '../platform/tauri/client';
import webRepository from './webRepository';

describe('WebRepository', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('keeps cookie management on the web bridge', async () => {
        vi.mocked(tauriClient.web.getCookies).mockResolvedValue('cookie-data');

        await expect(webRepository.clearCookies()).resolves.toBeUndefined();
        await expect(webRepository.getCookies()).resolves.toBe('cookie-data');
        await expect(
            webRepository.setCookies('next-cookie-data')
        ).resolves.toBeUndefined();

        expect(tauriClient.web.clearCookies).toHaveBeenCalledTimes(1);
        expect(tauriClient.web.getCookies).toHaveBeenCalledTimes(1);
        expect(tauriClient.web.setCookies).toHaveBeenCalledWith('next-cookie-data');
    });
});
