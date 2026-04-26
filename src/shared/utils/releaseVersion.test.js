import { describe, expect, it } from 'vitest';

import {
    compareReleaseVersions,
    formatReleaseDisplayVersion,
    parseReleaseVersion
} from './releaseVersion.js';

describe('releaseVersion utilities', () => {
    it('parses current release tags into canonical display data', () => {
        expect(parseReleaseVersion('v2026.04')).toEqual({
            year: 2026,
            month: 4,
            patchNumber: 0,
            betaNumber: null,
            alphaNumber: null,
            channel: 'Stable',
            buildVersion: '2026.4.0',
            canonicalVersion: '2026.04',
            displayVersion: '2026.04'
        });
        expect(parseReleaseVersion('v2026.04.1')).toMatchObject({
            patchNumber: 1,
            buildVersion: '2026.4.1',
            canonicalVersion: '2026.04.1',
            displayVersion: '2026.04.1'
        });
        expect(parseReleaseVersion('2026.04-beta.12')).toMatchObject({
            patchNumber: 0,
            betaNumber: 12,
            channel: 'Beta',
            buildVersion: '2026.4.0-beta.12',
            canonicalVersion: '2026.04-beta.12',
            displayVersion: '2026.04-beta.12'
        });
        expect(parseReleaseVersion('v2026.04-alpha.12')).toMatchObject({
            patchNumber: 0,
            alphaNumber: 12,
            channel: 'Alpha',
            buildVersion: '2026.4.0-alpha.12',
            canonicalVersion: '2026.04-alpha.12',
            displayVersion: '2026.04-alpha.12'
        });
    });

    it('formats internal build versions for app display', () => {
        expect(parseReleaseVersion('2026.4.0-alpha.12')).toMatchObject({
            alphaNumber: 12,
            buildVersion: '2026.4.0-alpha.12',
            canonicalVersion: '2026.04-alpha.12',
            displayVersion: '2026.04-alpha.12'
        });
        expect(formatReleaseDisplayVersion('2026.4.1')).toBe('2026.04.1');
    });

    it('rejects malformed or out-of-range versions without rewriting them for display', () => {
        expect(parseReleaseVersion('v2026.4.0')).toBeNull();
        expect(parseReleaseVersion('v2026.04.0')).toBeNull();
        expect(parseReleaseVersion('v2026.04.1-beta.1')).toBeNull();
        expect(parseReleaseVersion('v2026.04-alpha.1000')).toBeNull();
        expect(parseReleaseVersion('v2026.04.alpha-2')).toBeNull();
        expect(parseReleaseVersion('2026.13.1')).toBeNull();
        expect(parseReleaseVersion('2026.4.-1')).toBeNull();
        expect(parseReleaseVersion('2026.4-beta.0')).toBeNull();
        expect(parseReleaseVersion('2026.4.0-alpha.0')).toBeNull();
        expect(formatReleaseDisplayVersion('nightly')).toBe('nightly');
    });

    it('orders releases by year, month, patch, then channel stability', () => {
        const versions = [
            '2026.04-beta.2',
            '2026.04.1',
            '2026.04',
            '2026.04-alpha.2',
            '2026.05-beta.1',
            '2026.04-beta.1',
            '2026.04-alpha.1',
            'bad'
        ];

        expect(versions.sort(compareReleaseVersions)).toEqual([
            'bad',
            '2026.04-alpha.1',
            '2026.04-alpha.2',
            '2026.04-beta.1',
            '2026.04-beta.2',
            '2026.04',
            '2026.04.1',
            '2026.05-beta.1'
        ]);
    });
});
