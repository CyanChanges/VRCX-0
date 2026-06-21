import { describe, expect, it } from 'vitest';

import { feedEntryCorrectionId } from './feedLiveStore';

const goldenFeedEntryCorrectionIds = [
    {
        input: {
            id: 'feed-entry-1',
            type: 'GPS',
            rowId: '10',
            sourceRank: '2'
        },
        expected: 'id:feed-entry-1'
    },
    {
        input: {
            type: 'GPS',
            rowId: '10',
            sourceRank: '2'
        },
        expected: 'row:GPS:2:10'
    },
    {
        input: {
            type: 'Online',
            row_id: '11',
            source_rank: '3'
        },
        expected: 'row:Online:3:11'
    },
    {
        input: {
            type: 'invite',
            created_at: '2026-06-21T00:00:00.000Z',
            userId: 'usr_sender',
            details: {
                location: 'wrld_world:123'
            },
            message: 'Join me'
        },
        expected:
            'invite:2026-06-21T00:00:00.000Z:usr_sender:wrld_world:123:Join me'
    }
];

describe('feedEntryCorrectionId', () => {
    it('matches the Rust correction id golden vectors', () => {
        for (const vector of goldenFeedEntryCorrectionIds) {
            expect(feedEntryCorrectionId(vector.input)).toBe(vector.expected);
        }
    });
});
