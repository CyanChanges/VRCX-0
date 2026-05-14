import { useEffect, useState } from 'react';

import { userFacingErrorMessage } from '@/lib/errorDisplay';
import playerListPersistenceRepository from '@/repositories/playerListPersistenceRepository';
import vrchatInstanceRepository from '@/repositories/vrchatInstanceRepository';
import {
    recordGameRuntimePresence,
    recordLocationHintsFromInstances
} from '@/services/domainIngestionService';
import { parseLocation } from '@/shared/utils/locationParser';

import {
    mergePlayerRowsWithApiUsers,
    normalizeString,
    shouldFetchInstanceUsers
} from './playerListRows';

function normalizeApiInstanceUsers(...sources: any[]) {
    const rows = [];
    const seen = new Set();

    const push = (value: any) => {
        if (!value) {
            return;
        }
        if (value instanceof Map) {
            for (const entry of value.values()) {
                push(entry);
            }
            return;
        }
        if (Array.isArray(value)) {
            for (const entry of value) {
                push(entry);
            }
            return;
        }
        if (typeof value === 'string') {
            const userId = normalizeString(value);
            if (userId && !seen.has(userId)) {
                seen.add(userId);
                rows.push({
                    displayName: userId,
                    id: userId,
                    source: 'instance-api',
                    userId
                });
            }
            return;
        }
        if (typeof value !== 'object') {
            return;
        }
        if (
            !value.id &&
            !value.userId &&
            !value.user_id &&
            !value.displayName &&
            !value.display_name &&
            !value.username &&
            !value.name
        ) {
            for (const entry of Object.values(value)) {
                push(entry);
            }
            return;
        }

        const userId = normalizeString(
            value.id || value.userId || value.user_id
        );
        const displayName = normalizeString(
            value.displayName ||
                value.display_name ||
                value.username ||
                value.name ||
                userId
        );
        const key = userId || displayName.toLowerCase();
        if (!key || seen.has(key)) {
            return;
        }
        seen.add(key);
        rows.push({
            ...value,
            displayName,
            id: userId || key,
            ref:
                value.ref && typeof value.ref === 'object'
                    ? value.ref
                    : value,
            source: 'instance-api',
            userId
        });
    };

    for (const source of sources) {
        push(source);
    }

    return rows;
}

function createRuntimeContext({
    playerListLocation,
    playerListWorldId,
    source = 'runtime'
}: any) {
    return {
        createdAt: '',
        groupName: '',
        location: playerListLocation || '',
        playerCount: 0,
        source,
        time: 0,
        worldId: playerListWorldId || '',
        worldName: ''
    };
}

export function useCurrentPlayerRows({
    addGameLogEventCount,
    currentUserEndpoint,
    currentUserId,
    currentUserSnapshot,
    gameLogDisabled,
    gameLogTailSyncedAt,
    isGameRunning,
    logLocationSnapshot,
    playerListLocation,
    playerListStartedAt,
    playerListWorldId
}: any) {
    const [loadStatus, setLoadStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const [context, setContext] = useState<any>({
        createdAt: '',
        groupName: '',
        location: '',
        playerCount: 0,
        source: 'none',
        time: 0,
        worldId: '',
        worldName: ''
    });
    const [playerRows, setPlayerRows] = useState<any[]>([]);

    useEffect(() => {
        let active = true;

        if (gameLogDisabled) {
            setLoadStatus('idle');
            setDetail('Game log ingestion is disabled.');
            setContext(
                createRuntimeContext({
                    playerListLocation,
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (!isGameRunning) {
            setLoadStatus('idle');
            setDetail('');
            setContext(
                createRuntimeContext({
                    playerListLocation,
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (!playerListLocation) {
            setLoadStatus('idle');
            setDetail('Waiting for the current runtime location.');
            setContext(
                createRuntimeContext({
                    playerListLocation: '',
                    playerListWorldId
                })
            );
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        if (playerListLocation === 'traveling') {
            setLoadStatus('idle');
            setDetail('');
            setContext({
                createdAt: '',
                groupName: '',
                location: 'traveling',
                playerCount: 0,
                source: 'runtime',
                time: 0,
                worldId: '',
                worldName: ''
            });
            setPlayerRows([]);
            return () => {
                active = false;
            };
        }

        setLoadStatus('running');
        setDetail('');

        playerListPersistenceRepository
            .getCurrentInstanceSnapshot({
                currentLocation: playerListLocation,
                currentLocationStartedAt: playerListStartedAt,
                currentUserId
            })
            .then(async (result: any) => {
                if (!active) {
                    return;
                }

                const parsed = parseLocation(result.context?.location || '');
                let players = Array.isArray(result.players)
                    ? result.players
                    : [];
                let instancePayload = null;
                if (
                    parsed.worldId &&
                    parsed.instanceId &&
                    shouldFetchInstanceUsers(players)
                ) {
                    const response = await vrchatInstanceRepository
                        .getInstance({
                            endpoint: currentUserEndpoint,
                            force: true,
                            instanceId: parsed.instanceId,
                            worldId: parsed.worldId
                        })
                        .catch(() => null);
                    if (!active) {
                        return;
                    }
                    instancePayload = response?.json || null;
                    const instanceUsers = normalizeApiInstanceUsers(
                        instancePayload?.users,
                        instancePayload?.players,
                        instancePayload?.playerList,
                        instancePayload?.userList,
                        instancePayload?.userIds,
                        instancePayload?.usersById
                    );
                    players = players.length
                        ? mergePlayerRowsWithApiUsers(players, instanceUsers)
                        : instanceUsers;
                }

                const nextContext: any = {
                    ...result.context,
                    playerCount: players.length || result.context.playerCount
                };
                if (
                    logLocationSnapshot?.location &&
                    logLocationSnapshot.location === nextContext.location
                ) {
                    nextContext.createdAt =
                        nextContext.createdAt || logLocationSnapshot.createdAt;
                    nextContext.worldName =
                        nextContext.worldName || logLocationSnapshot.worldName;
                }
                recordLocationHintsFromInstances({
                    endpoint: currentUserEndpoint,
                    instances: [
                        {
                            ...(instancePayload || {}),
                            instanceId: parsed.instanceId,
                            location: nextContext.location || playerListLocation,
                            players,
                            users: players,
                            worldId: parsed.worldId || nextContext.worldId,
                            worldName: nextContext.worldName
                        }
                    ]
                });
                recordGameRuntimePresence({
                    currentLocation: nextContext.location || playerListLocation,
                    currentLocationPlayers: players,
                    currentLocationStartedAt:
                        nextContext.createdAt || playerListStartedAt,
                    currentUserId,
                    currentUserSnapshot,
                    currentWorldName: nextContext.worldName,
                    endpoint: currentUserEndpoint
                });
                setContext(nextContext);
                setPlayerRows(players);
                setLoadStatus('ready');
                setDetail(
                    result.context.source === 'database'
                        ? 'Rebuilt the current instance roster from local join/leave history.'
                        : players.length
                          ? 'Loaded current instance users from the VRChat instance API while local game-log history catches up.'
                          : 'Using the current runtime location while waiting for more local game-log history.'
                );
            })
            .catch((error: any) => {
                if (!active) {
                    return;
                }

                setLoadStatus('error');
                setPlayerRows([]);
                setDetail(
                    userFacingErrorMessage(
                        error,
                        'Failed to reconstruct current players for the current instance.'
                    )
                );
            });

        return () => {
            active = false;
        };
    }, [
        addGameLogEventCount,
        currentUserEndpoint,
        currentUserId,
        currentUserSnapshot,
        gameLogDisabled,
        gameLogTailSyncedAt,
        isGameRunning,
        logLocationSnapshot?.createdAt,
        logLocationSnapshot?.location,
        logLocationSnapshot?.worldName,
        playerListLocation,
        playerListStartedAt,
        playerListWorldId
    ]);

    return {
        context,
        detail,
        loadStatus,
        playerRows
    };
}
