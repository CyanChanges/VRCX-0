import sqliteRepository from './sqliteRepository.js';
import type { SQLiteRepository } from './sqliteRepository.js';
import type {
    FriendLogHistoryEntry,
    FriendLogType
} from './friendLogHistoryRepository.js';
import { normalizeUserTablePrefix } from './userSessionRepository.js';

export interface FriendLogCurrentRow {
    userId: string;
    displayName: string;
    trustLevel: string;
    friendNumber: number;
}

export interface FriendLogCurrentEntry {
    userId?: string | null;
    displayName?: string | null;
    trustLevel?: string | null;
    friendNumber?: number | string | null;
}

export interface FriendLogCurrentReplaceOptions {
    historyEntries?: FriendLogHistoryEntry[];
    addedHistoryEntries?: FriendLogHistoryEntry[];
}

export interface FriendLogCurrentDeleteOptions {
    historyEntries?: FriendLogHistoryEntry[];
}

export interface FriendLogCurrentUpsertOptions {
    historyEntry?: FriendLogHistoryEntry;
    forceHistory?: boolean;
}

type FriendLogSourceRow = unknown[] | Record<string, unknown>;

function valueAsString(value: unknown): string {
    return value == null ? '' : String(value);
}

function valueAsInt(value: unknown): number {
    return Number.parseInt(String(value ?? 0), 10) || 0;
}

function normalizeTargetUserId(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : String(value ?? '').trim();
}

function normalizeFriendLogRow(row: FriendLogSourceRow): FriendLogCurrentRow {
    if (Array.isArray(row)) {
        return {
            userId: valueAsString(row[0]),
            displayName: valueAsString(row[1]),
            trustLevel: valueAsString(row[2] ?? 'Visitor'),
            friendNumber: valueAsInt(row[3])
        };
    }

    return {
        userId: valueAsString(row.user_id ?? row.userId),
        displayName: valueAsString(row.display_name ?? row.displayName),
        trustLevel: valueAsString(row.trust_level ?? row.trustLevel ?? 'Visitor'),
        friendNumber: valueAsInt(row.friend_number ?? row.friendNumber)
    };
}

async function addFriendLogHistoryEntry(
    tx: SQLiteRepository,
    userPrefix: string,
    entry: FriendLogHistoryEntry | null | undefined
) {
    if (!entry?.type || !entry?.userId) {
        return;
    }

    await tx.executeNonQuery(
        `INSERT INTO ${userPrefix}_friend_log_history (created_at, type, user_id, display_name, previous_display_name, trust_level, previous_trust_level, friend_number) VALUES (@created_at, @type, @user_id, @display_name, @previous_display_name, @trust_level, @previous_trust_level, @friend_number)`,
        {
            '@created_at': entry.created_at ?? '',
            '@type': entry.type ?? '',
            '@user_id': entry.userId ?? '',
            '@display_name': entry.displayName ?? '',
            '@previous_display_name': entry.previousDisplayName ?? '',
            '@trust_level': entry.trustLevel ?? '',
            '@previous_trust_level': entry.previousTrustLevel ?? '',
            '@friend_number': valueAsInt(entry.friendNumber)
        }
    );
}

async function getFriendLogCurrent(
    userId: unknown
): Promise<FriendLogCurrentRow[]> {
    const userPrefix = normalizeUserTablePrefix(userId);
    const rows = await sqliteRepository.query<FriendLogSourceRow>(
        `SELECT user_id, display_name, trust_level, friend_number FROM ${userPrefix}_friend_log_current ORDER BY friend_number ASC, display_name COLLATE NOCASE ASC, user_id ASC`
    );

    if (!Array.isArray(rows)) {
        return [];
    }

    return rows
        .map(normalizeFriendLogRow)
        .filter((row) => typeof row.userId === 'string' && row.userId.trim());
}

async function replaceFriendLogCurrent(
    userId: unknown,
    entries: FriendLogCurrentEntry[] = [],
    options: FriendLogCurrentReplaceOptions = {}
) {
    const userPrefix = normalizeUserTablePrefix(userId);
    const historyEntries = Array.isArray(options?.historyEntries)
        ? options.historyEntries
        : [];
    const addedHistoryEntries = Array.isArray(options?.addedHistoryEntries)
        ? options.addedHistoryEntries
        : [];

    const historyCount = await sqliteRepository.transaction(async (tx) => {
        let writtenHistoryCount = 0;
        for (const entry of historyEntries) {
            const targetUserId = normalizeTargetUserId(entry?.userId);
            if (!targetUserId) {
                continue;
            }

            const affectedRows = Number(
                await tx.executeNonQuery(
                    `DELETE FROM ${userPrefix}_friend_log_current WHERE user_id = @user_id`,
                    {
                        '@user_id': targetUserId
                    }
                )
            );
            if (Number.isFinite(affectedRows) && affectedRows > 0) {
                await addFriendLogHistoryEntry(tx, userPrefix, entry);
                writtenHistoryCount += 1;
            }
        }

        for (const entry of addedHistoryEntries) {
            const targetUserId = normalizeTargetUserId(entry?.userId);
            if (!targetUserId) {
                continue;
            }

            const existingRows = await tx.query(
                `SELECT user_id FROM ${userPrefix}_friend_log_current WHERE user_id = @user_id LIMIT 1`,
                {
                    '@user_id': targetUserId
                }
            );
            if (!Array.isArray(existingRows) || existingRows.length === 0) {
                await addFriendLogHistoryEntry(tx, userPrefix, entry);
                writtenHistoryCount += 1;
            }
        }

        await tx.executeNonQuery(
            `DELETE FROM ${userPrefix}_friend_log_current`
        );

        for (const entry of entries) {
            if (!entry?.userId) {
                continue;
            }

            await tx.executeNonQuery(
                `INSERT OR REPLACE INTO ${userPrefix}_friend_log_current (user_id, display_name, trust_level, friend_number) VALUES (@user_id, @display_name, @trust_level, @friend_number)`,
                {
                    '@user_id': entry.userId,
                    '@display_name': entry.displayName ?? '',
                    '@trust_level': entry.trustLevel ?? 'Visitor',
                    '@friend_number': valueAsInt(entry.friendNumber)
                }
            );
        }

        return writtenHistoryCount;
    });

    return {
        userId:
            typeof userId === 'string'
                ? userId.trim()
                : String(userId ?? '').trim(),
        count: Array.isArray(entries) ? entries.length : 0,
        historyCount
    };
}

async function deleteFriendLogCurrentArray(
    userId: unknown,
    targetUserIds: unknown[] = [],
    options: FriendLogCurrentDeleteOptions = {}
) {
    const userPrefix = normalizeUserTablePrefix(userId);
    const normalizedTargetUserIds = Array.isArray(targetUserIds)
        ? targetUserIds
              .map((targetUserId) =>
                  typeof targetUserId === 'string'
                      ? targetUserId.trim()
                      : String(targetUserId ?? '').trim()
              )
              .filter(Boolean)
        : [];
    if (!normalizedTargetUserIds.length) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            count: 0,
            historyCount: 0
        };
    }

    const historyEntries = Array.isArray(options?.historyEntries)
        ? options.historyEntries
        : [];
    const historyEntriesById = new Map(
        historyEntries
            .map((entry) => [
                normalizeTargetUserId(entry?.userId),
                entry
            ] as const)
            .filter(([targetUserId]) => Boolean(targetUserId))
    );

    const transactionResult = await sqliteRepository.transaction(async (tx) => {
        let deletedCount = 0;
        let writtenHistoryCount = 0;

        for (const targetUserId of normalizedTargetUserIds) {
            const affectedRows = Number(
                await tx.executeNonQuery(
                    `DELETE FROM ${userPrefix}_friend_log_current WHERE user_id = @user_id`,
                    {
                        '@user_id': targetUserId
                    }
                )
            );
            const historyEntry = historyEntriesById.get(targetUserId);
            if (Number.isFinite(affectedRows) && affectedRows > 0) {
                deletedCount += affectedRows;
            }
            if (
                historyEntry &&
                Number.isFinite(affectedRows) &&
                affectedRows > 0
            ) {
                await addFriendLogHistoryEntry(tx, userPrefix, historyEntry);
                writtenHistoryCount += 1;
            }
        }

        return {
            deletedCount,
            historyCount: writtenHistoryCount
        };
    });

    return {
        userId:
            typeof userId === 'string'
                ? userId.trim()
                : String(userId ?? '').trim(),
        count: transactionResult?.deletedCount ?? 0,
        historyCount: transactionResult?.historyCount ?? 0
    };
}

async function upsertFriendLogCurrent(
    userId: unknown,
    entry: FriendLogCurrentEntry | null | undefined,
    options: FriendLogCurrentUpsertOptions = {}
) {
    const userPrefix = normalizeUserTablePrefix(userId);
    if (!entry?.userId) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            targetUserId: '',
            count: 0,
            inserted: false,
            historyCount: 0
        };
    }

    const targetUserId =
        typeof entry.userId === 'string'
            ? entry.userId.trim()
            : String(entry.userId ?? '').trim();
    if (!targetUserId) {
        return {
            userId:
                typeof userId === 'string'
                    ? userId.trim()
                    : String(userId ?? '').trim(),
            targetUserId: '',
            count: 0,
            inserted: false,
            historyCount: 0
        };
    }

    const historyEntry = options?.historyEntry;
    const forceHistory = Boolean(options?.forceHistory);
    const transactionResult = await sqliteRepository.transaction(async (tx) => {
        const insertCount = Number(
            await tx.executeNonQuery(
                `INSERT OR IGNORE INTO ${userPrefix}_friend_log_current (user_id, display_name, trust_level, friend_number) VALUES (@user_id, @display_name, @trust_level, @friend_number)`,
                {
                    '@user_id': targetUserId,
                    '@display_name': entry.displayName ?? '',
                    '@trust_level': entry.trustLevel ?? 'Visitor',
                    '@friend_number': valueAsInt(entry.friendNumber)
                }
            )
        );
        const inserted = Number.isFinite(insertCount) && insertCount > 0;

        if (!inserted) {
            await tx.executeNonQuery(
                `UPDATE ${userPrefix}_friend_log_current SET display_name = @display_name, trust_level = @trust_level, friend_number = CASE WHEN @friend_number > 0 THEN @friend_number ELSE friend_number END WHERE user_id = @user_id`,
                {
                    '@user_id': targetUserId,
                    '@display_name': entry.displayName ?? '',
                    '@trust_level': entry.trustLevel ?? 'Visitor',
                    '@friend_number': valueAsInt(entry.friendNumber)
                }
            );
        }

        let historyCount = 0;
        if (
            (inserted || forceHistory) &&
            historyEntry?.type &&
            historyEntry?.userId
        ) {
            await addFriendLogHistoryEntry(tx, userPrefix, {
                ...historyEntry,
                userId: targetUserId,
                type: historyEntry.type as FriendLogType
            });
            historyCount = 1;
        }

        return {
            inserted,
            historyCount
        };
    });

    return {
        userId:
            typeof userId === 'string'
                ? userId.trim()
                : String(userId ?? '').trim(),
        targetUserId,
        count: 1,
        inserted: Boolean(transactionResult?.inserted),
        historyCount: transactionResult?.historyCount ?? 0
    };
}

async function deleteFriendLogCurrent(userId: unknown, targetUserId: string) {
    const userPrefix = normalizeUserTablePrefix(userId);
    await sqliteRepository.executeNonQuery(
        `DELETE FROM ${userPrefix}_friend_log_current WHERE user_id = @user_id`,
        {
            '@user_id': targetUserId
        }
    );
}

const friendLogRepository = {
    getFriendLogCurrent,
    deleteFriendLogCurrentArray,
    deleteFriendLogCurrent,
    upsertFriendLogCurrent,
    replaceFriendLogCurrent
};

export {
    deleteFriendLogCurrentArray,
    deleteFriendLogCurrent,
    getFriendLogCurrent,
    replaceFriendLogCurrent,
    upsertFriendLogCurrent
};
export default friendLogRepository;
