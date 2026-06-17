import { describe, expect, it, vi } from 'vitest';

const runtimeState = vi.hoisted(() => ({
    commands: {
        appModerationSyncRefresh: vi.fn(),
        appModerationSyncUpdate: vi.fn()
    }
}));

const authRecoveryState = vi.hoisted(() => ({
    handleRuntimeAuthFailure: vi.fn()
}));

vi.mock('@/platform/tauri/bindings', () => ({
    commands: runtimeState.commands
}));

vi.mock('./authSessionRecoveryService', () => ({
    handleRuntimeAuthFailure: authRecoveryState.handleRuntimeAuthFailure
}));

describe('moderationSyncService', () => {
    it('routes refresh missing credentials through runtime auth recovery', async () => {
        runtimeState.commands.appModerationSyncRefresh.mockRejectedValueOnce(
            new Error('Missing Credentials')
        );
        const { refreshModerationSync } =
            await import('./moderationSyncService');

        await expect(
            refreshModerationSync({ userId: 'usr_current', endpoint: '' })
        ).rejects.toMatchObject({
            status: 401,
            endpoint: 'auth/user/playermoderations'
        });
        expect(authRecoveryState.handleRuntimeAuthFailure).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 401,
                endpoint: 'auth/user/playermoderations'
            })
        );
    });

    it('routes mutation missing credentials through runtime auth recovery', async () => {
        runtimeState.commands.appModerationSyncUpdate.mockRejectedValueOnce(
            new Error('Missing Credentials')
        );
        const { updateModerationSync } =
            await import('./moderationSyncService');

        await expect(
            updateModerationSync({
                ownerUserId: 'usr_current',
                targetUserId: 'usr_target',
                type: 'block',
                enabled: false
            })
        ).rejects.toMatchObject({
            status: 401,
            endpoint: 'auth/user/unplayermoderate'
        });
        expect(authRecoveryState.handleRuntimeAuthFailure).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 401,
                endpoint: 'auth/user/unplayermoderate'
            })
        );
    });
});
