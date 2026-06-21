import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauriMock = vi.hoisted(() => ({
    commands: {
        appWorldCacheGet: vi.fn(),
        appVrchatWorldGet: vi.fn()
    }
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: tauriMock.commands
}));

import { clearEntityQueryCache } from '@/lib/entityQueryCache';
import { useWorldFactsStore } from '@/state/worldFactsStore';

import worldProfileRepository from './worldProfileRepository';

describe('WorldProfileRepository', () => {
    beforeEach(async () => {
        await clearEntityQueryCache();
        useWorldFactsStore.getState().resetWorldFacts();
        for (const command of Object.values(tauriMock.commands)) {
            command.mockReset();
            command.mockResolvedValue({
                status: 200,
                data: '{"ok":true}',
                raw: { source: 'rust-api' }
            });
        }
        tauriMock.commands.appWorldCacheGet.mockResolvedValue(null);
    });

    it('normalizes raw world API data into the shape dialogs and lists consume', () => {
        expect(
            worldProfileRepository.normalize({
                id: ' wrld_123 ',
                name: ' Test World ',
                description: '  A world  ',
                authorId: ' usr_author ',
                authorName: '',
                releaseStatus: '',
                thumbnailImageUrl: ' thumb.png ',
                imageUrl: ' image.png ',
                occupants: '12',
                capacity: '40',
                recommendedCapacity: '24',
                favorites: '100',
                visits: '2000',
                popularity: '7',
                heat: '5',
                tags: [' system_labs ', '', null],
                created_at: '2026-01-01',
                updated_at: '2026-01-02',
                platforms: ['standalonewindows', 'quest'],
                unityPackages: [
                    { platform: 'android' },
                    { platformName: 'ios' },
                    { assetVersion: { platform: 'windows' } }
                ]
            })
        ).toMatchObject({
            id: 'wrld_123',
            name: 'Test World',
            description: 'A world',
            authorId: 'usr_author',
            authorName: 'usr_author',
            releaseStatus: 'unknown',
            thumbnailImageUrl: 'thumb.png',
            imageUrl: 'image.png',
            occupants: 12,
            capacity: 40,
            recommendedCapacity: 24,
            favorites: 100,
            visits: 2000,
            popularity: 7,
            heat: 5,
            tags: ['system_labs'],
            isLabs: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            platforms: ['PC', 'Quest', 'iOS']
        });
    });

    it('uses mirrored world facts before local cache or remote fetch', async () => {
        useWorldFactsStore.getState().upsertWorldFacts({
            id: 'wrld_mirror',
            name: 'Mirror World',
            authorId: 'usr_author',
            imageUrl: 'image.png'
        });

        const world = await worldProfileRepository.getWorldProfile({
            worldId: 'wrld_mirror'
        });

        expect(world.name).toBe('Mirror World');
        expect(tauriMock.commands.appWorldCacheGet).not.toHaveBeenCalled();
        expect(tauriMock.commands.appVrchatWorldGet).not.toHaveBeenCalled();
    });

    it('uses local world cache before remote fetch for non-dialog reads', async () => {
        tauriMock.commands.appWorldCacheGet.mockResolvedValue({
            id: 'wrld_local',
            name: 'Local Cache World',
            authorId: 'usr_author',
            authorName: 'Author',
            created_at: '2026-01-01',
            description: 'Cached details',
            imageUrl: 'image.png',
            releaseStatus: 'public',
            thumbnailImageUrl: 'thumb.png',
            updated_at: '2026-01-02',
            version: 1
        });

        const world = await worldProfileRepository.getWorldProfile({
            worldId: 'wrld_local'
        });

        expect(world.name).toBe('Local Cache World');
        expect(tauriMock.commands.appWorldCacheGet).toHaveBeenCalledWith(
            'wrld_local'
        );
        expect(tauriMock.commands.appVrchatWorldGet).not.toHaveBeenCalled();
    });

    it('fetches remote data for dialog reads instead of using summary cache', async () => {
        tauriMock.commands.appWorldCacheGet.mockResolvedValue({
            id: 'wrld_dialog',
            name: 'Local Summary World'
        });
        tauriMock.commands.appVrchatWorldGet.mockResolvedValue({
            status: 200,
            data: JSON.stringify({
                id: 'wrld_dialog',
                name: 'Remote Dialog World',
                tags: ['system_labs']
            }),
            raw: {}
        });

        const world = await worldProfileRepository.getWorldProfile({
            worldId: 'wrld_dialog',
            dialog: true
        });

        expect(world.name).toBe('Remote Dialog World');
        expect(world.isLabs).toBe(true);
        expect(tauriMock.commands.appWorldCacheGet).not.toHaveBeenCalled();
        expect(tauriMock.commands.appVrchatWorldGet).toHaveBeenCalled();
    });

    it('fetches remote data for dialog reads instead of mirrored facts', async () => {
        useWorldFactsStore.getState().upsertWorldFacts({
            id: 'wrld_dialog_mirror',
            name: 'Mirrored Summary World'
        });
        tauriMock.commands.appVrchatWorldGet.mockResolvedValue({
            status: 200,
            data: JSON.stringify({
                id: 'wrld_dialog_mirror',
                name: 'Fresh Dialog World'
            }),
            raw: {}
        });

        const world = await worldProfileRepository.getWorldProfile({
            worldId: 'wrld_dialog_mirror',
            dialog: true
        });

        expect(world.name).toBe('Fresh Dialog World');
        expect(tauriMock.commands.appWorldCacheGet).not.toHaveBeenCalled();
        expect(tauriMock.commands.appVrchatWorldGet).toHaveBeenCalledWith({
            worldId: 'wrld_dialog_mirror',
            endpoint: ''
        });
    });

    it('throws request errors with status, endpoint, and parsed payload details', async () => {
        tauriMock.commands.appVrchatWorldGet.mockResolvedValue({
            status: 404,
            data: JSON.stringify({
                error: {
                    message: 'World not found'
                }
            }),
            raw: {}
        });

        await expect(
            worldProfileRepository.getWorldProfile({
                worldId: 'wrld_missing',
                force: true
            })
        ).rejects.toMatchObject({
            message: 'World not found',
            status: 404,
            endpoint: 'worlds/wrld_missing',
            payload: {
                error: {
                    message: 'World not found'
                }
            }
        });
    });
});
