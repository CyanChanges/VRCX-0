import { describe, expect, it } from 'vitest';

import { PlatformUnavailableError, normalizePlatformError } from './errors';

describe('tauri errors', () => {
    it('keeps Error instances when no extra fallback context is needed', () => {
        const error = new Error('Tauri command failed');

        expect(normalizePlatformError(error, 'Tauri command failed')).toBe(
            error
        );
        expect(normalizePlatformError(error)).toBe(error);
    });

    it('wraps Error instances with fallback context once', () => {
        const error = new TypeError('boom');
        const normalized = normalizePlatformError(error, 'SQLite query failed');

        expect(normalized).not.toBe(error);
        expect(normalized.name).toBe('TypeError');
        expect(normalized.message).toBe('SQLite query failed: boom');
        expect(normalized.cause).toBe(error);

        expect(normalizePlatformError(normalized, 'SQLite query failed')).toBe(
            normalized
        );
    });

    it('normalizes non-Error values into useful messages', () => {
        expect(
            normalizePlatformError(null, 'Tauri command failed').message
        ).toBe('Tauri command failed');
        expect(
            normalizePlatformError('denied', 'Tauri command failed').message
        ).toBe('Tauri command failed: denied');
        expect(
            normalizePlatformError({ code: 'E_FAIL' }, 'Tauri command failed')
                .message
        ).toBe('Tauri command failed: {"code":"E_FAIL"}');
    });

    it('uses a specific name for unavailable platform APIs', () => {
        const error = new PlatformUnavailableError();

        expect(error.name).toBe('PlatformUnavailableError');
        expect(error.message).toBe(
            'Tauri platform APIs are unavailable in this runtime'
        );
    });
});
