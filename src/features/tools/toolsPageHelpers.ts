import {
    getToolsByCategory,
    toolCategories
} from '@/shared/constants/tools';

export const categoryConfigKey = 'VRCX_toolsCategoryCollapsed';
export const quickAccessConfigKey = 'VRCX_toolsQuickAccessList';
export const quickAccessDropId = 'tools-quick-access-drop-zone';
export const toolCatalogDropId = 'tools-catalog-drop-zone';

const quickAccessDragPrefix = 'tools-quick-access-tool:';
const catalogDragPrefix = 'tools-catalog-tool:';
const collapsibleCategories = toolCategories.map((category: any) => category.key);

export const defaultCollapsedState: any = {
    group: false,
    image: false,
    shortcuts: false,
    social: false,
    system: false,
    user: false,
    other: false
};

export const toolsPageCategories = toolCategories
    .filter((category: any) => collapsibleCategories.includes(category.key))
    .map((category: any) => ({
        ...category,
        tools: getToolsByCategory(category.key)
    }));

const allTools = toolsPageCategories.flatMap((category: any) => category.tools);

export const knownToolKeys = new Set(allTools.map((tool: any) => tool.key));

const legacyPinnedToolAliases: any = {
    'auto-change-status': 'presence-room-rules'
};

export function normalizePinnedToolKey(toolKey: any) {
    return legacyPinnedToolAliases[toolKey] ?? toolKey;
}

export function getEquivalentToolNavKeys(toolKey: any) {
    const normalizedToolKey = normalizePinnedToolKey(toolKey);
    const equivalentToolKeys = new Set([normalizedToolKey]);

    for (const [legacyToolKey, targetToolKey] of Object.entries(
        legacyPinnedToolAliases
    )) {
        if (targetToolKey === normalizedToolKey) {
            equivalentToolKeys.add(legacyToolKey);
        }
    }

    return Array.from(equivalentToolKeys).map((key: any) => `tool-${key}`);
}

export function normalizeQuickAccessToolKeys(value: any) {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set();
    const nextKeys = [];
    for (const rawKey of value) {
        const toolKey = normalizePinnedToolKey(String(rawKey || ''));
        if (!knownToolKeys.has(toolKey) || seen.has(toolKey)) {
            continue;
        }
        seen.add(toolKey);
        nextKeys.push(toolKey);
    }
    return nextKeys;
}

export function parseQuickAccessToolKeys(value: any) {
    try {
        return normalizeQuickAccessToolKeys(JSON.parse(value || '[]'));
    } catch {
        return [];
    }
}

export function getQuickAccessDragId(toolKey: any) {
    return `${quickAccessDragPrefix}${toolKey}`;
}

export function getCatalogDragId(toolKey: any) {
    return `${catalogDragPrefix}${toolKey}`;
}

export function collectLayoutKeys(layout: any) {
    const keys = new Set();
    for (const entry of layout || []) {
        if (entry.type === 'item' && entry.key) {
            keys.add(entry.key);
        } else if (entry.type === 'folder') {
            for (const item of entry.items || []) {
                const key = typeof item === 'string' ? item : item?.key;
                if (key) {
                    keys.add(key);
                }
            }
        }
    }
    return keys;
}

export function insertToolNavItem(layout: any, navKey: any) {
    const nextLayout = Array.isArray(layout) ? [...layout] : [];
    if (collectLayoutKeys(nextLayout).has(navKey)) {
        return nextLayout;
    }
    const insertIndex = nextLayout.findIndex(
        (entry: any) =>
            entry.type === 'item' &&
            (entry.key === 'tools' || entry.key === 'direct-access')
    );
    if (insertIndex >= 0) {
        nextLayout.splice(insertIndex, 0, { type: 'item', key: navKey });
        return nextLayout;
    }
    return [...nextLayout, { type: 'item', key: navKey }];
}

export function removeToolNavItem(layout: any, navKey: any) {
    const navKeys = new Set(Array.isArray(navKey) ? navKey : [navKey]);

    return (layout || [])
        .map((entry: any) => {
            if (entry.type === 'item') {
                return navKeys.has(entry.key) ? null : entry;
            }
            if (entry.type === 'folder') {
                const nextItems = (entry.items || []).filter(
                    (item: any) =>
                        !navKeys.has(
                            typeof item === 'string' ? item : item?.key
                        )
                );
                return nextItems.length ? { ...entry, items: nextItems } : null;
            }
            return entry;
        })
        .filter(Boolean);
}
