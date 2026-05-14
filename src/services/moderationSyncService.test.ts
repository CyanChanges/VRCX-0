import { describe, expect, it, vi } from 'vitest';

const runtimeState = vi.hoisted(() => ({
    app: {
        ModerationSyncRefresh: vi.fn(),
        ModerationSyncUpdate: vi.fn()
    }
}));

const authRecoveryState = vi.hoisted(() => ({
    handleRuntimeAuthFailure: vi.fn()
}));

vi.mock('@/platform/tauri/client', () => ({
    tauriClient: {
        app: runtimeState.app
    }
}));

vi.mock('./authSessionRecoveryService', () => ({
    handleRuntimeAuthFailure: authRecoveryState.handleRuntimeAuthFailure
}));

describe('moderationSyncService', () => {
    it('routes refresh missing credentials through runtime auth recovery', async () => {
        runtimeState.app.ModerationSyncRefresh.mockRejectedValueOnce(
            new Error('Missing Credentials')
        );
        const { refreshModerationSync } = await import(
            './moderationSyncService'
        );

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
        runtimeState.app.ModerationSyncUpdate.mockRejectedValueOnce(
            new Error('Missing Credentials')
        );
        const { updateModerationSync } = await import(
            './moderationSyncService'
        );

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
