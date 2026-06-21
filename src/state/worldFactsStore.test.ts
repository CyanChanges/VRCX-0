import { beforeEach, describe, expect, it } from 'vitest';

import { useWorldFactsStore } from './worldFactsStore';

describe('worldFactsStore', () => {
    beforeEach(() => {
        useWorldFactsStore.getState().resetWorldFacts();
    });

    it('caps mirrored world facts and evicts the oldest ids', () => {
        const worlds = Array.from({ length: 513 }, (_, index) => ({
            id: `wrld_${index}`,
            name: `World ${index}`
        }));

        useWorldFactsStore.getState().upsertWorldFacts(worlds);

        const state = useWorldFactsStore.getState();
        expect(Object.keys(state.worldsById)).toHaveLength(512);
        expect(state.order).toHaveLength(512);
        expect(state.getWorldFact('wrld_0')).toBeNull();
        expect(state.getWorldFact('wrld_1')).toMatchObject({
            id: 'wrld_1',
            name: 'World 1'
        });
        expect(state.getWorldFact('wrld_512')).toMatchObject({
            id: 'wrld_512',
            name: 'World 512'
        });
    });
});
