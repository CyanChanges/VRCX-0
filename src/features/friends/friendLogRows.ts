export function sortRows(rows: any) {
    return rows.slice().sort((left: any, right: any) => {
        const leftTs = Date.parse(left?.created_at ?? '');
        const rightTs = Date.parse(right?.created_at ?? '');
        if (
            Number.isFinite(leftTs) &&
            Number.isFinite(rightTs) &&
            leftTs !== rightTs
        ) {
            return rightTs - leftTs;
        }

        const leftId = Number.parseInt(left?.rowId ?? 0, 10) || 0;
        const rightId = Number.parseInt(right?.rowId ?? 0, 10) || 0;
        return rightId - leftId;
    });
}

export function normalizeUserId(value: any) {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

export function getFriendLogRowKey(row: any, ownerUserId: any = '') {
    const owner = normalizeUserId(ownerUserId);
    const rowId = Number.parseInt(row?.rowId ?? 0, 10) || 0;
    if (rowId > 0) {
        return `${owner}:row:${rowId}`;
    }

    return `${owner}:composite:${row?.created_at || ''}:${row?.type || ''}:${row?.userId || ''}`;
}

export function matchesSearch(row: any, searchQuery: any) {
    if (!searchQuery) {
        return true;
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
        return true;
    }

    return String(row?.displayName ?? '')
        .toLowerCase()
        .includes(query);
}
