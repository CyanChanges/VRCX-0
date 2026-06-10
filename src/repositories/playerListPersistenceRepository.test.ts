import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tauriClient } from '@/platform/tauri/client';

import { getCurrentInstanceSnapshot } from './playerListPersistenceRepository';

vi.mock('@/platform/tauri/client', () => ({
    tauriClient: {
        app: {
            PlayerListLocationGet: vi.fn(),
            PlayerListLatestLocationGet: vi.fn(),
            PlayerListJoinLeaveRows: vi.fn()
        }
    }
}));

describe('playerListPersistenceRepository', () => {
    beforeEach(() => {
        vi.mocked(tauriClient.app.PlayerListLocationGet).mockReset();
        vi.mocked(tauriClient.app.PlayerListLatestLocationGet).mockReset();
        vi.mocked(tauriClient.app.PlayerListJoinLeaveRows).mockReset();
    });

    it('does not include join rows from earlier visits to the same instance', async () => {
        vi.mocked(tauriClient.app.PlayerListLocationGet).mockResolvedValueOnce({
            created_at: '2026-04-30T10:00:00.000Z',
            location: 'wrld_live:123',
            world_id: 'wrld_live',
            world_name: 'Live World',
            time: 0,
            group_name: ''
        });
        vi.mocked(tauriClient.app.PlayerListJoinLeaveRows).mockResolvedValueOnce([
            {
                id: '1',
                created_at: '2026-01-01T10:00:00.000Z',
                type: 'OnPlayerJoined',
                display_name: 'Old Player',
                user_id: 'usr_old',
                time: 0
            },
            {
                id: '2',
                created_at: '2026-04-30T10:01:00.000Z',
                type: 'OnPlayerJoined',
                display_name: 'Current Player',
                user_id: 'usr_current',
                time: 0
            }
        ]);

        await expect(
            getCurrentInstanceSnapshot({
                currentLocation: 'wrld_live:123'
            })
        ).resolves.toMatchObject({
            players: [
                {
                    userId: 'usr_current',
                    displayName: 'Current Player'
                }
            ]
        });
    });

    it('uses the runtime location start time over stale database location rows', async () => {
        vi.mocked(tauriClient.app.PlayerListLocationGet).mockResolvedValueOnce({
            created_at: '2026-01-01T10:00:00.000Z',
            location: 'wrld_live:123',
            world_id: 'wrld_live',
            world_name: 'Live World',
            time: 0,
            group_name: ''
        });
        vi.mocked(tauriClient.app.PlayerListJoinLeaveRows).mockResolvedValueOnce([
            {
                id: '1',
                created_at: '2026-01-01T10:01:00.000Z',
                type: 'OnPlayerJoined',
                display_name: 'Old Player',
                user_id: 'usr_old',
                time: 0
            },
            {
                id: '2',
                created_at: '2026-04-30T10:01:00.000Z',
                type: 'OnPlayerJoined',
                display_name: 'Current Player',
                user_id: 'usr_current',
                time: 0
            }
        ]);

        const snapshot = await getCurrentInstanceSnapshot({
            currentLocation: 'wrld_live:123',
            currentLocationStartedAt: '2026-04-30T10:00:00.000Z'
        });

        expect(snapshot.context.createdAt).toBe('2026-04-30T10:00:00.000Z');
        expect(snapshot.players).toEqual([
            expect.objectContaining({
                userId: 'usr_current',
                displayName: 'Current Player'
            })
        ]);
    });

    it('removes a joined row by unique display name when the leave row has a different id key', async () => {
        vi.mocked(tauriClient.app.PlayerListLocationGet).mockResolvedValueOnce({
            created_at: '2026-04-30T10:00:00.000Z',
            location: 'wrld_live:123',
            world_id: 'wrld_live',
            world_name: 'Live World',
            time: 0,
            group_name: ''
        });
        vi.mocked(tauriClient.app.PlayerListJoinLeaveRows).mockResolvedValueOnce([
            {
                id: '1',
                created_at: '2026-04-30T10:01:00.000Z',
                type: 'OnPlayerJoined',
                display_name: 'Left Player',
                user_id: '',
                time: 0
            },
            {
                id: '2',
                created_at: '2026-04-30T10:02:00.000Z',
                type: 'OnPlayerLeft',
                display_name: 'Left Player',
                user_id: 'usr_left',
                time: 60000
            }
        ]);

        await expect(
            getCurrentInstanceSnapshot({
                currentLocation: 'wrld_live:123'
            })
        ).resolves.toMatchObject({
            players: []
        });
    });

    it('falls back to the database enter time when a stale runtime start filters the roster out', async () => {
        vi.mocked(tauriClient.app.PlayerListLocationGet).mockResolvedValueOnce({
            created_at: '2026-06-09T12:26:31.000Z',
            location: 'wrld_live:83220',
            world_id: 'wrld_live',
            world_name: 'Live World',
            time: 0,
            group_name: ''
        });
        const joinRow = {
            id: '1',
            created_at: '2026-06-09T12:26:59.000Z',
            type: 'OnPlayerJoined',
            display_name: 'CyanChanges',
            user_id: 'usr_cyan',
            time: 0
        };
        vi.mocked(tauriClient.app.PlayerListJoinLeaveRows)
            .mockResolvedValueOnce([joinRow])
            .mockResolvedValueOnce([joinRow]);

        const snapshot = await getCurrentInstanceSnapshot({
            currentLocation: 'wrld_live:83220',
            // WS user-location fallback "now", later than every join row
            currentLocationStartedAt: '2026-06-10T19:00:00.000Z'
        });

        expect(snapshot.players).toEqual([
            expect.objectContaining({
                userId: 'usr_cyan',
                displayName: 'CyanChanges'
            })
        ]);
        expect(snapshot.context.createdAt).toBe('2026-06-09T12:26:31.000Z');
        expect(snapshot.context.playerFactsKnown).toBe(true);
    });
});
