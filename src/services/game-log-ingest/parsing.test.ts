import { describe, expect, it } from 'vitest';

import { parseRawRow } from './parsing';

describe('GameLog raw row parsing', () => {
    it('parses runtime-persisted external mirror rows', () => {
        expect(
            parseRawRow({
                runtimePersisted: true,
                raw: [
                    'runtime-ipc',
                    '2026-05-14T00:00:00.000Z',
                    'external',
                    'hello',
                    'User',
                    'usr_1',
                    'wrld_test:1'
                ]
            })
        ).toMatchObject({
            runtimePersisted: true,
            dt: '2026-05-14T00:00:00.000Z',
            type: 'external',
            message: 'hello',
            displayName: 'User',
            userId: 'usr_1',
            location: 'wrld_test:1'
        });
    });
});
