export function emptyArray(value: any) {
    return Array.isArray(value) ? value : [];
}

export function dedupeById(items: any) {
    const map = new Map();
    for (const item of emptyArray(items)) {
        if (item?.id) {
            map.set(item.id, item);
        }
    }
    return Array.from(map.values());
}
