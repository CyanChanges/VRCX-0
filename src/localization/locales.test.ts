import { describe, expect, it } from 'vitest';

import { normalizeLanguageCode } from './locales';

describe('normalizeLanguageCode', () => {
    it('keeps exact supported language codes', () => {
        expect(normalizeLanguageCode('en')).toBe('en');
        expect(normalizeLanguageCode('ja')).toBe('ja');
        expect(normalizeLanguageCode('zh-CN')).toBe('zh-CN');
        expect(normalizeLanguageCode('zh-TW')).toBe('zh-TW');
    });

    it('maps regional system languages to supported app languages', () => {
        expect(normalizeLanguageCode('en-US')).toBe('en');
        expect(normalizeLanguageCode('ja-JP')).toBe('ja');
        expect(normalizeLanguageCode('ko-KR')).toBe('ko');
        expect(normalizeLanguageCode('pt-BR')).toBe('pt');
    });

    it('normalizes underscore separators from host locale values', () => {
        expect(normalizeLanguageCode('en_US')).toBe('en');
        expect(normalizeLanguageCode('zh_Hant_TW')).toBe('zh-TW');
    });

    it('maps simplified and traditional Chinese system locales explicitly', () => {
        expect(normalizeLanguageCode('zh')).toBe('zh-CN');
        expect(normalizeLanguageCode('zh-Hans')).toBe('zh-CN');
        expect(normalizeLanguageCode('zh-Hans-CN')).toBe('zh-CN');
        expect(normalizeLanguageCode('zh-SG')).toBe('zh-CN');
        expect(normalizeLanguageCode('zh-Hant')).toBe('zh-TW');
        expect(normalizeLanguageCode('zh-Hant-HK')).toBe('zh-TW');
        expect(normalizeLanguageCode('zh-HK')).toBe('zh-TW');
    });

    it('falls back to English for unsupported or empty languages', () => {
        expect(normalizeLanguageCode('de-DE')).toBe('en');
        expect(normalizeLanguageCode('')).toBe('en');
        expect(normalizeLanguageCode(null)).toBe('en');
    });
});
