import { describe, expect, it } from 'vitest';

import { mergeLocalSnapshotIntoProfile } from './useUserDialogProfileResource.js';

describe('mergeLocalSnapshotIntoProfile', () => {
    it('refreshes presence fields without erasing full profile fields', () => {
        const profile = {
            id: 'usr_target',
            displayName: 'Target',
            bio: 'Full profile bio',
            bioLinks: ['https://example.test'],
            date_joined: '2024-05-19',
            status: 'active',
            location: 'private'
        };
        const localSnapshot = {
            id: 'usr_target',
            displayName: 'Target',
            status: 'join me',
            location: 'wrld_live:12345',
            bio: '',
            date_joined: ''
        };

        expect(mergeLocalSnapshotIntoProfile(localSnapshot, profile)).toEqual({
            ...profile,
            status: 'join me',
            location: 'wrld_live:12345'
        });
    });

    it('does not clear profile presence with normalized empty snapshot defaults', () => {
        const profile = {
            id: 'usr_target',
            displayName: 'Target',
            bio: 'Full profile bio',
            status: 'active',
            location: 'wrld_profile:12345'
        };
        const localSnapshot = {
            id: 'usr_target',
            displayName: 'Target',
            status: '',
            location: ''
        };

        expect(mergeLocalSnapshotIntoProfile(localSnapshot, profile)).toEqual(
            profile
        );
    });
});
