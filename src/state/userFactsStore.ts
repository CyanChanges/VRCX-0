import { create } from 'zustand';

import {
    mergeUserFact,
    userFactKey,
    type UserFact,
    type UserFactMergeOptions
} from '@/domain/users/userFacts';

interface UserFactsStoreState {
    version: number;
    usersByKey: Record<string, UserFact>;
    userIdsByEndpoint: Record<string, string[]>;
    upsertUserFact: (
        input: Record<string, unknown>,
        options?: UserFactMergeOptions
    ) => void;
    upsertUserFacts: (
        entries: Array<Record<string, unknown>>,
        options?: UserFactMergeOptions
    ) => void;
    upsertUserFactEntries: (
        entries: Array<{
            input: Record<string, unknown>;
            options?: UserFactMergeOptions;
        }>
    ) => void;
    resetUserFacts: () => void;
}

const initialState: any = {
    version: 0,
    usersByKey: {},
    userIdsByEndpoint: {}
};

function endpointFromKey(key: string): string {
    return key.split('::')[0] || 'default';
}

function mergeEntries(
    state: Pick<UserFactsStoreState, 'usersByKey' | 'userIdsByEndpoint'>,
    entries: Array<{
        input: Record<string, unknown>;
        options?: UserFactMergeOptions;
    }>
) {
    let changed = false;
    let usersByKey = state.usersByKey;
    let userIdsByEndpoint = state.userIdsByEndpoint;

    for (const entry of entries) {
        const input = entry?.input;
        if (!input || typeof input !== 'object') {
            continue;
        }
        const options = entry.options || {};
        const key = userFactKey(options.endpoint, input.id ?? input.userId);
        if (!key) {
            continue;
        }
        const existing = usersByKey[key];
        const nextFact = mergeUserFact(existing, input, options);
        if (existing === nextFact) {
            continue;
        }
        if (!changed) {
            usersByKey = { ...usersByKey };
            userIdsByEndpoint = { ...userIdsByEndpoint };
            changed = true;
        }
        usersByKey[key] = nextFact;
        const endpoint = endpointFromKey(key);
        const currentIds = userIdsByEndpoint[endpoint] || [];
        if (!currentIds.includes(nextFact.id)) {
            userIdsByEndpoint[endpoint] = [...currentIds, nextFact.id];
        }
    }

    return changed
        ? {
              usersByKey,
              userIdsByEndpoint
          }
        : null;
}

export const useUserFactsStore = create<UserFactsStoreState>((set: any) => ({
    ...initialState,
    upsertUserFact(input: any, options: any = {}) {
        set((state: any) => {
            const merged = mergeEntries(state, [{ input, options }]);
            if (!merged) {
                return state;
            }
            return {
                version: state.version + 1,
                ...merged
            };
        });
    },
    upsertUserFacts(entries: any, options: any = {}) {
        useUserFactsStore.getState().upsertUserFactEntries(
            (Array.isArray(entries) ? entries : []).map((input: any) => ({
                input,
                options
            }))
        );
    },
    upsertUserFactEntries(entries: any) {
        set((state: any) => {
            const merged = mergeEntries(
                state,
                Array.isArray(entries) ? entries : []
            );
            if (!merged) {
                return state;
            }
            return {
                version: state.version + 1,
                ...merged
            };
        });
    },
    resetUserFacts() {
        set(initialState);
    }
}));

export type { UserFactsStoreState };
