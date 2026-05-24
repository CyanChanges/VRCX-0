import { describe, expect, it } from 'vitest';

import {
    FEED_COLUMNS_DEFAULT_CONFIG,
    sanitizeFeedColumnConfig,
    sanitizeFeedColumnsConfig,
    sanitizeFeedViewMode
} from './feedColumnsState';

describe('feed columns state helpers', () => {
    it('keeps table as the fallback view mode', () => {
        expect(sanitizeFeedViewMode('columns')).toBe('columns');
        expect(sanitizeFeedViewMode('table')).toBe('table');
        expect(sanitizeFeedViewMode('bad')).toBe('table');
    });

    it('provides the accepted default columns without an All column', () => {
        expect(FEED_COLUMNS_DEFAULT_CONFIG.map((column) => column.title)).toEqual([
            'Location',
            'Favorites',
            'Profile',
            'Presence'
        ]);
        expect(FEED_COLUMNS_DEFAULT_CONFIG[1]).toMatchObject({
            friendScope: { kind: 'favorites', groupKeys: 'all' }
        });
    });

    it('sanitizes column scope, types, and width', () => {
        expect(
            sanitizeFeedColumnConfig({
                id: ' bad id ',
                title: '  Custom  ',
                width: 9999,
                friendScope: {
                    kind: 'favorites',
                    groupKeys: ['group-a', '', 'group-a', 'group-b']
                },
                feedTypes: ['GPS', 'Bad', 'Online', 'GPS']
            })
        ).toEqual({
            id: expect.any(String),
            title: 'Custom',
            width: 420,
            friendScope: {
                kind: 'favorites',
                groupKeys: ['group-a', 'group-b']
            },
            feedTypes: ['GPS', 'Online']
        });
    });

    it('expands the legacy Favorites column title', () => {
        expect(
            sanitizeFeedColumnConfig({
                id: 'fav',
                title: 'Fav',
                friendScope: { kind: 'favorites', groupKeys: 'all' },
                feedTypes: ['GPS']
            })
        ).toMatchObject({
            id: 'fav',
            title: 'Favorites'
        });
    });

    it('preserves an explicitly empty selected favorite group scope', () => {
        expect(
            sanitizeFeedColumnConfig({
                id: 'empty-favorites',
                title: 'Empty Favorites',
                friendScope: {
                    kind: 'favorites',
                    groupKeys: []
                },
                feedTypes: ['GPS']
            })
        ).toMatchObject({
            friendScope: {
                kind: 'favorites',
                groupKeys: []
            }
        });
    });

    it('falls back to defaults when persisted columns are unusable', () => {
        expect(sanitizeFeedColumnsConfig([])).toEqual(FEED_COLUMNS_DEFAULT_CONFIG);
        expect(sanitizeFeedColumnsConfig([{ title: '', feedTypes: [] }])).toEqual(
            FEED_COLUMNS_DEFAULT_CONFIG
        );
    });
});
