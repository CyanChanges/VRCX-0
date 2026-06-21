import { create } from 'zustand';

type WorldFact = Record<string, unknown> & {
    id?: unknown;
    worldId?: unknown;
};

interface WorldFactsStoreState {
    version: number;
    worldsById: Record<string, WorldFact>;
    order: string[];
    upsertWorldFacts: (
        worlds: WorldFact | WorldFact[] | null | undefined
    ) => void;
    getWorldFact: (worldId: unknown) => WorldFact | null;
    resetWorldFacts: () => void;
}

const WORLD_FACTS_CAPACITY = 512;

const initialState: Pick<
    WorldFactsStoreState,
    'version' | 'worldsById' | 'order'
> = {
    version: 0,
    worldsById: {},
    order: []
};

function normalizeWorldId(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function worldIdFromFact(world: WorldFact): string {
    return normalizeWorldId(world?.id ?? world?.worldId);
}

export const useWorldFactsStore = create<WorldFactsStoreState>(
    (set: any, get: any) => ({
        ...initialState,
        upsertWorldFacts(worlds: any) {
            const list = Array.isArray(worlds) ? worlds : [worlds];
            set((state: WorldFactsStoreState) => {
                let changed = false;
                let worldsById = state.worldsById;
                let order = state.order;
                for (const world of list) {
                    if (!world || typeof world !== 'object') {
                        continue;
                    }
                    const worldId = worldIdFromFact(world);
                    if (!worldId) {
                        continue;
                    }
                    if (!changed) {
                        worldsById = { ...worldsById };
                        order = [...order];
                        changed = true;
                    }
                    const isNewWorld = !worldsById[worldId];
                    worldsById[worldId] = {
                        ...(worldsById[worldId] || {}),
                        ...world,
                        id: worldId
                    };
                    if (isNewWorld) {
                        order.push(worldId);
                    }
                    while (order.length > WORLD_FACTS_CAPACITY) {
                        const evictedWorldId = order.shift();
                        if (evictedWorldId) {
                            delete worldsById[evictedWorldId];
                        }
                    }
                }
                if (!changed) {
                    return state;
                }
                return {
                    version: state.version + 1,
                    worldsById,
                    order
                };
            });
        },
        getWorldFact(worldId: any) {
            return get().worldsById[normalizeWorldId(worldId)] || null;
        },
        resetWorldFacts() {
            set(initialState);
        }
    })
);

export type { WorldFact, WorldFactsStoreState };
