import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    getWorldProfile: vi.fn(),
    getGroupProfile: vi.fn(),
    getCurrentInstanceSnapshot: vi.fn(),
    setActive: vi.fn(),
    setAssets: vi.fn(),
    t: vi.fn()
}));

vi.mock('@/platform/index.js', () => ({
    backend: {
        discord: {
            SetActive: mocks.setActive,
            SetAssets: mocks.setAssets
        }
    }
}));

vi.mock('@/repositories/index.js', () => ({
    configRepository: {
        getBool: mocks.getBool
    },
    groupProfileRepository: {
        getGroupProfile: mocks.getGroupProfile
    },
    playerListRepository: {
        getCurrentInstanceSnapshot: mocks.getCurrentInstanceSnapshot
    },
    worldProfileRepository: {
        getWorldProfile: mocks.getWorldProfile
    }
}));

vi.mock('./i18nService.js', () => ({
    default: {
        t: mocks.t
    }
}));

import { useRuntimeStore } from '@/state/runtimeStore.js';

import {
    invalidateDiscordPresenceCache,
    refreshDiscordPresence
} from './discordPresenceService.js';

const labels = {
    'dialog.new_instance.access_type_public': 'Public',
    'dialog.new_instance.access_type_invite_plus': 'Invite+',
    'dialog.new_instance.access_type_invite': 'Invite',
    'dialog.new_instance.access_type_friend': 'Friends',
    'dialog.new_instance.access_type_friend_plus': 'Friends+',
    'dialog.new_instance.access_type_group': 'Group',
    'dialog.new_instance.group_access_type_public': 'Group Public',
    'dialog.new_instance.group_access_type_plus': 'Group+',
    'dialog.user.status.active': 'Active',
    'dialog.user.status.join_me': 'Join Me',
    'dialog.user.status.ask_me': 'Ask Me',
    'dialog.user.status.busy': 'Busy',
    'dialog.user.status.offline': 'Offline',
    'view.settings.discord_presence.rpc.desktop': 'Desktop',
    'view.settings.discord_presence.rpc.vr': 'VR',
    'view.settings.discord_presence.rpc.private_world': 'Private World'
};

const enabledDiscordConfig = {
    discordActive: true,
    discordInstance: true,
    discordHideInvite: false,
    discordJoinButton: true,
    discordHideImage: false,
    discordShowPlatform: true,
    discordWorldIntegration: true,
    discordWorldNameAsDiscordStatus: false
};

describe('discordPresenceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateDiscordPresenceCache();
        useRuntimeStore.getState().resetRuntimeState();

        mocks.t.mockImplementation((key) => labels[key] ?? key);
        mocks.getBool.mockImplementation((key, fallback) =>
            Promise.resolve(
                Object.hasOwn(enabledDiscordConfig, key)
                    ? enabledDiscordConfig[key]
                    : fallback
            )
        );
        mocks.setActive.mockResolvedValue(true);
        mocks.setAssets.mockResolvedValue(true);
        mocks.getWorldProfile.mockResolvedValue({
            name: 'Great Pug',
            thumbnailImageUrl: 'https://images.example.test/world-thumb.png',
            imageUrl: 'https://images.example.test/world-full.png',
            capacity: 16,
            releaseStatus: 'public'
        });
        mocks.getGroupProfile.mockResolvedValue({
            name: 'Test Group'
        });
        mocks.getCurrentInstanceSnapshot.mockResolvedValue({
            players: [{ id: 'usr_self' }, { id: 'usr_a' }, { id: 'usr_b' }]
        });
    });

    function setRunningWindowsPresence({ isGameNoVR }) {
        useRuntimeStore.getState().setAuthBootstrap({
            currentUserId: 'usr_self',
            currentUserEndpoint: 'https://api.vrchat.cloud/api/1',
            currentUserSnapshot: {
                status: 'active',
                presence: {
                    platform: 'standalonewindows'
                }
            }
        });
        useRuntimeStore.getState().setGameState({
            isGameRunning: true,
            isGameNoVR,
            currentLocation: 'wrld_public:12345~region(us)',
            currentLocationStartedAt: '2026-05-08T00:00:00.000Z',
            currentLocationPlayerIds: ['usr_self', 'usr_runtime']
        });
    }

    it('publishes active Windows desktop presence with player count and world image', async () => {
        setRunningWindowsPresence({ isGameNoVR: true });

        await refreshDiscordPresence({ force: true });

        expect(mocks.setActive).toHaveBeenCalledWith(true);
        expect(mocks.setAssets).toHaveBeenCalledTimes(1);

        const { appId, activity } = mocks.setAssets.mock.calls[0][0];
        expect(appId).toBe('883308884863901717');
        expect(activity).toMatchObject({
            type: 0,
            name: 'VRChat',
            details: 'Great Pug',
            state: 'Public #12345 (Desktop)',
            status_display_type: 0,
            details_url: 'https://vrchat.com/home/world/wrld_public',
            assets: {
                large_image: 'https://images.example.test/world-thumb.png',
                small_image: 'active',
                small_text: 'Active'
            },
            party: {
                id: 'wrld_public:12345',
                size: [3, 16]
            },
            buttons: [
                {
                    label: 'Join',
                    url: 'https://vrchat.com/home/launch?worldId=wrld_public&instanceId=12345~region(us)'
                }
            ]
        });
    });

    it('publishes active Windows VR presence through the final Discord activity payload', async () => {
        setRunningWindowsPresence({ isGameNoVR: false });

        await refreshDiscordPresence({ force: true });

        const { activity } = mocks.setAssets.mock.calls[0][0];
        expect(activity.state).toBe('Public #12345 (VR)');
        expect(activity.assets).toMatchObject({
            small_image: 'active',
            small_text: 'Active'
        });
    });
});
