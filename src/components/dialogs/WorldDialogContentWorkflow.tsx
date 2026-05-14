import { CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState as AppEmptyState } from '@/components/layout/PageScaffold';
import { ImageCropDialog } from '@/components/media/ImageCropDialog';
import {
    convertFileUrlToImageUrl,
    copyTextToClipboard
} from '@/services/entityMediaService';
import { getFileAnalysisForUnityPackages } from '@/lib/fileAnalysis';
import {
    defaultWorldCacheInfo,
    readWorldCacheInfo,
    resolveWorldAssetBundleArgs
} from '@/lib/worldAssetBundle';
import { assetBundleRepository } from '@/repositories/assetBundleRepository';
import configRepository from '@/repositories/configRepository';
import gameLogRepository from '@/repositories/gameLogRepository';
import groupProfileRepository from '@/repositories/groupProfileRepository';
import mediaRepository from '@/repositories/mediaRepository';
import memoPersistenceRepository from '@/repositories/memoPersistenceRepository';
import userProfileRepository from '@/repositories/userProfileRepository';
import vrchatAuthRepository from '@/repositories/vrchatAuthRepository';
import vrchatInstanceRepository from '@/repositories/vrchatInstanceRepository';
import worldProfileRepository from '@/repositories/worldProfileRepository';
import { tryOpenLaunchLocation } from '@/services/directAccessService';
import { selfInviteToInstance } from '@/services/launchService';
import { openFolderAndSelectItem } from '@/services/shellIntegrationService';
import {
    IMAGE_UPLOAD_ACCEPT,
    readFileAsBase64,
    validateImageUploadFile,
    withUploadTimeout
} from '@/shared/utils/imageUpload';
import { parseLocation } from '@/shared/utils/locationParser';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Spinner } from '@/ui/shadcn/spinner';

import { InstanceInviteDialog } from './InstanceInviteDialog';
import { useWorldDialogOwnerActions } from './world-dialog/useWorldDialogOwnerActions';
import { useWorldDialogRuntimeState } from './world-dialog/useWorldDialogRuntimeState';
import { resolveCreatedInstanceDetails } from './world-dialog/worldInstanceResolver';
import {
    normalizeEntityId,
    parseRoleIds,
    resolveInstanceLocation
} from './world-dialog/worldInstances';
import { WorldNewInstanceDialog } from './world-dialog/WorldNewInstanceDialog';
import { WorldDialogTabbedView } from './world-dialog/WorldDialogTabbedView';
import {
    WorldAllowedDomainsDialog,
    WorldDetailsDialog,
    WorldTagsDialog
} from './WorldOwnerEditDialogs';

function WorldDialogEmptyState({
    title,
    description,
    loading = false,
    children
}: any) {
    return (
        <AppEmptyState
            className="min-h-56"
            title={title}
            description={description}
            icon={loading ? Spinner : undefined}
        >
            {children}
        </AppEmptyState>
    );
}

function isWorldNotFoundMessage(message: any, worldId: any) {
    const normalizedMessage = normalizeEntityId(message);
    const normalizedWorldId = normalizeEntityId(worldId);
    const match = /^World\s+(.+?)\s+not found\.?$/i.exec(normalizedMessage);

    return (
        Boolean(normalizedWorldId) &&
        normalizeEntityId(match?.[1]) === normalizedWorldId
    );
}

function worldLoadErrorDescription(
    error: any,
    t: any,
    worldId: any,
    fallbackKey: any
) {
    if (error instanceof Error) {
        if (isWorldNotFoundMessage(error.message, worldId)) {
            return t('dialog.world.error.world_not_found_description', {
                worldId
            });
        }
        return error.message;
    }

    return t(fallbackKey);
}

function defaultWorldSideData() {
    return {
        fileAnalysis: {},
        cache: defaultWorldCacheInfo()
    };
}

function normalizeInstanceRegion(value: any) {
    const region = normalizeEntityId(value);
    switch (region) {
        case 'us':
        case 'US West':
            return 'US West';
        case 'use':
        case 'US East':
            return 'US East';
        case 'eu':
        case 'Europe':
            return 'Europe';
        case 'jp':
        case 'Japan':
            return 'Japan';
        default:
            return region;
    }
}

function normalizeNewInstanceSeed(seed: any) {
    if (!seed || typeof seed !== 'object') {
        return {};
    }
    const groupId = normalizeEntityId(seed.groupId);
    return {
        ...(seed.accessType
            ? { accessType: normalizeEntityId(seed.accessType) }
            : {}),
        ...(seed.region
            ? { region: normalizeInstanceRegion(seed.region) }
            : {}),
        ...(groupId ? { accessType: 'group', groupId } : {}),
        ...(seed.groupAccessType
            ? { groupAccessType: normalizeEntityId(seed.groupAccessType) }
            : {}),
        ...(seed.groupName
            ? { groupName: normalizeEntityId(seed.groupName) }
            : {})
    };
}

function groupOptionId(group: any) {
    return normalizeEntityId(group?.groupId || group?.id);
}

function findGroupOption(groups: any, groupId: any) {
    const normalizedGroupId = normalizeEntityId(groupId);
    if (!normalizedGroupId) {
        return null;
    }
    return (
        (Array.isArray(groups) ? groups : []).find(
            (group: any) => groupOptionId(group) === normalizedGroupId
        ) || null
    );
}

export function WorldDialogContentWorkflow({
    worldId,
    seedData = null,
    initialAction = '',
    openNonce = 0,
    initialActionNonce = 0,
    initialNewInstanceDefaults = null
}: any) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const normalizedWorldId = normalizeEntityId(worldId);
    const profileWorldId = normalizedWorldId.split(':')[0] || normalizedWorldId;
    const {
        closeDialog,
        confirm,
        currentEndpoint,
        currentHomeLocation,
        currentUserId,
        prompt,
        setAuthBootstrap,
        showLaunchDialog,
        updateEntityDialogMetadata
    } = useWorldDialogRuntimeState();
    const [world, setWorld] = useState(() =>
        seedData ? worldProfileRepository.normalize(seedData) : null
    );
    const [loadStatus, setLoadStatus] = useState(
        normalizedWorldId ? 'running' : 'idle'
    );
    const [actionStatus, setActionStatus] = useState('idle');
    const [detail, setDetail] = useState('');
    const [memo, setMemo] = useState('');
    const [previousInstances, setPreviousInstances] = useState<any[]>([]);
    const [hasPersistData, setHasPersistData] = useState(false);
    const [worldSideData, setWorldSideData] = useState(() =>
        defaultWorldSideData()
    );
    const [newInstanceRequest, setNewInstanceRequest] = useState(null);
    const [newInstanceGroups, setNewInstanceGroups] = useState<any[]>([]);
    const [inviteRequest, setInviteRequest] = useState(null);
    const [imageCropRequest, setImageCropRequest] = useState(null);
    const [ownerEditor, setOwnerEditor] = useState('');
    const actionStatusRef = useRef('idle');
    const memoRevisionRef = useRef(0);
    const activeWorldTargetRef = useRef<any>({
        worldId: profileWorldId,
        endpoint: currentEndpoint
    });
    const handledInitialActionRef = useRef('');
    const imageUploadInputRef = useRef(null);
    const imageUploadWorldRef = useRef(null);

    useEffect(() => {
        setWorld(seedData ? worldProfileRepository.normalize(seedData) : null);
    }, [seedData]);

    useEffect(() => {
        activeWorldTargetRef.current = {
            worldId: profileWorldId,
            endpoint: currentEndpoint
        };
    }, [currentEndpoint, profileWorldId]);

    useEffect(() => {
        if (!world?.id || !world?.name) {
            return;
        }
        updateEntityDialogMetadata({
            kind: 'world',
            entityId: normalizedWorldId,
            title: world.name
        });
    }, [normalizedWorldId, updateEntityDialogMetadata, world?.id, world?.name]);

    useEffect(() => {
        imageUploadWorldRef.current = null;
        setImageCropRequest(null);
        setNewInstanceRequest(null);
        setOwnerEditor('');
        setWorldSideData(defaultWorldSideData());
        handledInitialActionRef.current = '';
    }, [profileWorldId]);

    useEffect(() => {
        let active = true;

        if (!currentUserId) {
            setNewInstanceGroups([]);
            return () => {
                active = false;
            };
        }

        groupProfileRepository
            .getUserGroups({
                userId: currentUserId,
                endpoint: currentEndpoint
            })
            .then((groups: any) => {
                if (!active) {
                    return;
                }
                setNewInstanceGroups(
                    (Array.isArray(groups) ? groups : [])
                        .filter((group: any) => groupOptionId(group))
                        .sort((left: any, right: any) =>
                            normalizeEntityId(left?.name).localeCompare(
                                normalizeEntityId(right?.name)
                            )
                        )
                );
            })
            .catch(() => {
                if (active) {
                    setNewInstanceGroups([]);
                }
            });

        return () => {
            active = false;
        };
    }, [currentEndpoint, currentUserId]);

    useEffect(() => {
        let active = true;

        if (!world?.id) {
            setWorldSideData(defaultWorldSideData());
            return () => {
                active = false;
            };
        }

        const targetWorldId = world.id;
        const targetEndpoint = currentEndpoint;
        vrchatAuthRepository
            .getConfig({ endpoint: targetEndpoint })
            .catch(() => null)
            .then((configResponse: any) =>
                Promise.allSettled([
                    readWorldCacheInfo(world, targetEndpoint),
                    getFileAnalysisForUnityPackages({
                        unityPackages: world.unityPackages,
                        sdkUnityVersion: String(
                            configResponse?.json?.sdkUnityVersion || ''
                        ),
                        endpoint: targetEndpoint
                    })
                ])
            )
            .then(([cacheResult, fileAnalysisResult]: any) => {
                if (
                    active &&
                    isCurrentWorldTarget(targetWorldId, targetEndpoint)
                ) {
                    setWorldSideData({
                        cache:
                            cacheResult.status === 'fulfilled'
                                ? cacheResult.value
                                : defaultWorldSideData().cache,
                        fileAnalysis:
                            fileAnalysisResult.status === 'fulfilled'
                                ? fileAnalysisResult.value
                                : {}
                    });
                }
            })
            .catch(() => {
                if (
                    active &&
                    isCurrentWorldTarget(targetWorldId, targetEndpoint)
                ) {
                    setWorldSideData(defaultWorldSideData());
                }
            });

        return () => {
            active = false;
        };
    }, [currentEndpoint, world?.id, world?.updatedAt, world?.version]);

    useEffect(() => {
        let active = true;

        if (!normalizedWorldId) {
            setWorld(null);
            setLoadStatus('error');
            setDetail(
                t('dialog.world.empty.no_world_id_was_provided_for_this_dialog')
            );
            return () => {
                active = false;
            };
        }

        setWorld(seedData ? worldProfileRepository.normalize(seedData) : null);
        setLoadStatus('running');
        setDetail('');

        worldProfileRepository
            .getWorldProfile({
                worldId: profileWorldId,
                endpoint: currentEndpoint,
                dialog: true
            })
            .then((nextWorld: any) => {
                if (!active) {
                    return;
                }

                setWorld(nextWorld);
                setLoadStatus('ready');
            })
            .catch((error: any) => {
                if (!active) {
                    return;
                }

                if (seedData) {
                    setWorld(worldProfileRepository.normalize(seedData));
                    setLoadStatus('ready');
                    setDetail(
                        worldLoadErrorDescription(
                            error,
                            t,
                            profileWorldId,
                            'dialog.world.error.failed_to_refresh_the_remote_world_snapshot'
                        )
                    );
                    return;
                }

                setWorld(null);
                setLoadStatus('error');
                setDetail(
                    worldLoadErrorDescription(
                        error,
                        t,
                        profileWorldId,
                        'dialog.world.error.failed_to_load_the_world_profile'
                    )
                );
            });

        return () => {
            active = false;
        };
    }, [currentEndpoint, normalizedWorldId, profileWorldId, seedData]);

    useEffect(() => {
        let active = true;

        if (!profileWorldId) {
            setMemo('');
            return () => {
                active = false;
            };
        }

        setMemo('');
        const revision = memoRevisionRef.current;
        memoPersistenceRepository
            .getWorldMemo(profileWorldId)
            .then((entry: any) => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo(entry?.memo || '');
                }
            })
            .catch(() => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo('');
                }
            });

        return () => {
            active = false;
        };
    }, [profileWorldId]);

    useEffect(() => {
        let active = true;

        if (!profileWorldId) {
            setHasPersistData(false);
            return () => {
                active = false;
            };
        }

        if (!currentUserId) {
            setHasPersistData(Boolean(world?.hasPersistData));
            return () => {
                active = false;
            };
        }

        worldProfileRepository
            .hasWorldPersistentData({
                userId: currentUserId,
                worldId: profileWorldId,
                endpoint: currentEndpoint
            })
            .then((exists: any) => {
                if (active) {
                    setHasPersistData(exists);
                }
            })
            .catch(() => {
                if (active) {
                    setHasPersistData(Boolean(world?.hasPersistData));
                }
            });

        return () => {
            active = false;
        };
    }, [currentEndpoint, currentUserId, profileWorldId, world?.hasPersistData]);

    useEffect(() => {
        let active = true;

        if (!profileWorldId) {
            setPreviousInstances([]);
            return () => {
                active = false;
            };
        }

        gameLogRepository
            .getPreviousInstancesByWorldId({ worldId: profileWorldId })
            .then((rows: any) => {
                if (!active) {
                    return;
                }
                const values = Array.isArray(rows) ? rows : [];
                setPreviousInstances(values);
            })
            .catch(() => {
                if (active) {
                    setPreviousInstances([]);
                }
            });

        return () => {
            active = false;
        };
    }, [profileWorldId]);

    useEffect(() => {
        const normalizedInitialAction = normalizeEntityId(initialAction);
        const actionKey = `${profileWorldId}:${normalizedInitialAction}:${initialActionNonce}`;
        if (
            !world?.id ||
            !normalizedInitialAction ||
            handledInitialActionRef.current === actionKey
        ) {
            return;
        }

        handledInitialActionRef.current = actionKey;
        if (normalizedInitialAction === 'newInstanceSelfInvite') {
            openNewInstanceDialog(true, initialNewInstanceDefaults);
        } else if (normalizedInitialAction === 'newInstance') {
            openNewInstanceDialog(false, initialNewInstanceDefaults);
        }
    }, [
        initialAction,
        initialActionNonce,
        initialNewInstanceDefaults,
        newInstanceGroups,
        profileWorldId,
        world?.id
    ]);

    const isInstanceLocation = normalizedWorldId.includes(':');
    const worldDialogShortName = isInstanceLocation
        ? parseLocation(normalizedWorldId).shortName
        : '';
    const isHomeWorld =
        normalizeEntityId(currentHomeLocation) === normalizeEntityId(world?.id);
    const canUpdateHome = Boolean(currentUserId && world?.id);
    const canManageWorld =
        normalizeEntityId(world?.authorId) === normalizeEntityId(currentUserId);

    async function copyUnavailableWorldId() {
        if (!profileWorldId) {
            return;
        }
        await copyTextToClipboard(profileWorldId);
        toast.success(t('message.world.id_copied'));
    }

    function isCurrentWorldTarget(targetWorldId: any, targetEndpoint: any) {
        return (
            activeWorldTargetRef.current.worldId ===
                normalizeEntityId(targetWorldId) &&
            activeWorldTargetRef.current.endpoint === targetEndpoint
        );
    }

    const ownerActions = useWorldDialogOwnerActions({
        actionStatusRef,
        canManageWorld,
        closeDialog,
        confirm,
        currentEndpoint,
        currentUserId,
        isCurrentWorldTarget,
        prompt,
        setActionStatus,
        setHasPersistData,
        setOwnerEditor,
        setWorld,
        world
    });

    if (loadStatus === 'running' && !world) {
        return (
            <WorldDialogEmptyState
                loading
                title={t('dialog.world.loading.loading_world_profile')}
                description={t(
                    'dialog.world.loading.fetching_the_current_vrchat_world_snapshot_for_this_dialog'
                )}
            />
        );
    }

    if (!world) {
        return (
            <WorldDialogEmptyState
                title={t('dialog.world.error.world_profile_unavailable')}
                description={
                    detail ||
                    t(
                        'dialog.world.description.world_snapshot_unavailable_description'
                    )
                }
            >
                {profileWorldId ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            copyUnavailableWorldId();
                        }}
                    >
                        <CopyIcon data-icon="inline-start" />
                        {t('dialog.world.info.copy_id')}
                    </Button>
                ) : null}
            </WorldDialogEmptyState>
        );
    }

    const imageUrl = convertFileUrlToImageUrl(
        world.imageUrl || world.thumbnailImageUrl,
        512
    );
    const worldForView: any = {
        ...world,
        $isCached: worldSideData.cache.inCache,
        $cacheSize: worldSideData.cache.cacheSize,
        $cacheLocked: worldSideData.cache.cacheLocked,
        $cachePath: worldSideData.cache.cachePath,
        fileAnalysis: worldSideData.fileAnalysis
    };

    async function refreshWorldProfile() {
        if (actionStatusRef.current !== 'idle') {
            return;
        }

        const targetWorldId = profileWorldId;
        const targetEndpoint = currentEndpoint;
        actionStatusRef.current = 'refresh';
        setActionStatus('refresh');
        try {
            const nextWorld = await worldProfileRepository.getWorldProfile({
                worldId: targetWorldId,
                endpoint: targetEndpoint,
                force: true
            });
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                return;
            }
            setWorld(nextWorld);
            toast.success(t('dialog.world.success.world_refreshed'));
        } catch (error) {
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                return;
            }
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_refresh_world')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    async function launchInstance() {
        if (!isInstanceLocation || actionStatusRef.current !== 'idle') {
            return;
        }

        actionStatusRef.current = 'launching';
        setActionStatus('launching');
        try {
            const opened = await tryOpenLaunchLocation(
                normalizedWorldId,
                worldDialogShortName,
                currentEndpoint
            );
            if (opened) {
                toast.success(
                    t('dialog.world.success.vrchat_launch_request_sent')
                );
                return;
            }
            toast.error(
                t('dialog.world.error.unable_to_open_this_instance_in_vrchat')
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_launch_vrchat_instance')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    async function updateHomeLocation() {
        if (!canUpdateHome || actionStatusRef.current !== 'idle') {
            return;
        }

        actionStatusRef.current = 'home';
        setActionStatus('home');
        const nextHomeLocation = isHomeWorld ? '' : world.id;
        const result = await confirm({
            title: isHomeWorld
                ? t('dialog.world.modal.reset_home_world')
                : t('dialog.world.modal.make_home_world'),
            description: isHomeWorld
                ? t('dialog.world.action.reset_your_vrchat_home_location')
                : t(
                      'dialog.world.dynamic.set_value_as_your_vrchat_home_world',
                      { value: world.name || world.id }
                  ),
            confirmText: isHomeWorld
                ? t('dialog.world.actions.reset_home')
                : t('dialog.world.actions.make_home'),
            cancelText: t('common.actions.cancel')
        });

        if (!result.ok) {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
            return;
        }

        try {
            const nextUser = await userProfileRepository.updateCurrentUser({
                userId: currentUserId,
                endpoint: currentEndpoint,
                params: {
                    homeLocation: nextHomeLocation
                }
            });
            if (nextUser?.id) {
                setAuthBootstrap({
                    currentUserId: nextUser.id,
                    currentUserDisplayName:
                        nextUser.displayName ||
                        nextUser.username ||
                        nextUser.id,
                    currentUserSnapshot: nextUser
                });
            }
            toast.success(
                isHomeWorld
                    ? t('dialog.world.toast.home_world_reset')
                    : t('message.world.home_updated')
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_update_home_world')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    async function saveMemo(nextValue: any) {
        const targetWorldId = normalizeEntityId(world.id);
        memoRevisionRef.current += 1;
        try {
            const nextEntry = await memoPersistenceRepository.saveWorldMemo({
                worldId: targetWorldId,
                memo: nextValue
            });
            if (activeWorldTargetRef.current.worldId !== targetWorldId) {
                return;
            }
            const nextMemo = String(nextEntry.memo || '');
            setMemo(nextMemo);
            toast.success(
                nextMemo
                    ? t('dialog.world.toast.memo_saved')
                    : t('dialog.world.toast.memo_cleared')
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_save_memo')
            );
        }
    }

    async function openWorldCacheFolder() {
        const cachePath = worldSideData.cache.cachePath;
        if (!cachePath) {
            return;
        }
        try {
            await openFolderAndSelectItem(cachePath, true);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_open_world_cache_folder')
            );
        }
    }

    async function deleteWorldCache() {
        if (actionStatusRef.current !== 'idle') {
            return;
        }
        const targetWorld = world;
        const targetWorldId = targetWorld.id;
        const targetEndpoint = currentEndpoint;
        actionStatusRef.current = 'cache';
        setActionStatus('cache');
        try {
            const configResponse = await vrchatAuthRepository
                .getConfig({ endpoint: targetEndpoint })
                .catch(() => null);
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                return;
            }
            const args = resolveWorldAssetBundleArgs(
                targetWorld,
                String(configResponse?.json?.sdkUnityVersion || '')
            );
            if (!args) {
                toast.error(
                    t('dialog.world.error.world_cache_location_unavailable')
                );
                return;
            }
            await assetBundleRepository.deleteCache(
                args.fileId,
                args.fileVersion,
                args.variant,
                args.variantVersion
            );
            const cache = await readWorldCacheInfo(targetWorld, targetEndpoint);
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                return;
            }
            setWorldSideData((current: any) => ({ ...current, cache }));
            toast.success(t('dialog.world.success.world_cache_deleted'));
        } catch (error) {
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                return;
            }
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_delete_world_cache')
            );
        } finally {
            if (actionStatusRef.current === 'cache') {
                actionStatusRef.current = 'idle';
                setActionStatus('idle');
            }
        }
    }

    async function editMemo() {
        const result = await prompt({
            title: t('dialog.world.modal.edit_local_memo'),
            description: world.name || world.id,
            inputValue: memo,
            multiline: true,
            confirmText: t('common.actions.save'),
            cancelText: t('common.actions.cancel')
        });

        if (!result.ok) {
            return;
        }

        await saveMemo(result.value);
    }

    async function loadNewInstanceDefaults(seed: any = null) {
        const [
            accessType,
            region,
            groupId,
            groupAccessType,
            ageGate,
            queueEnabled,
            displayName,
            instanceName,
            legacyUserId
        ] = await Promise.all([
            configRepository.getString('instanceDialogAccessType', 'public'),
            configRepository.getString('instanceRegion', 'US West'),
            configRepository.getString('instanceDialogGroupId', ''),
            configRepository.getString('instanceDialogGroupAccessType', 'plus'),
            configRepository.getBool('instanceDialogAgeGate', false),
            configRepository.getBool('instanceDialogQueueEnabled', true),
            configRepository.getString('instanceDialogDisplayName', ''),
            configRepository.getString('instanceDialogInstanceName', ''),
            configRepository.getString('instanceDialogUserId', '')
        ]);
        const seedDefaults = normalizeNewInstanceSeed(seed);
        const selectedGroupId =
            seedDefaults.groupId || normalizeEntityId(groupId) || '';
        const selectedGroup = findGroupOption(
            newInstanceGroups,
            selectedGroupId
        );
        return {
            accessType:
                seedDefaults.accessType ||
                accessType ||
                (selectedGroupId ? 'group' : 'public'),
            region: seedDefaults.region || region || 'US West',
            groupId: selectedGroupId,
            groupName: selectedGroup?.name || seedDefaults.groupName || '',
            groupAccessType:
                seedDefaults.groupAccessType || groupAccessType || 'plus',
            queueEnabled: Boolean(queueEnabled),
            ageGate: Boolean(ageGate),
            displayName: displayName || '',
            roleIds: '',
            instanceName: instanceName || '',
            legacyUserId: legacyUserId || currentUserId || ''
        };
    }

    async function openNewInstanceDialog(
        selfInvite: any = false,
        seed: any = null
    ) {
        if (!world.id || actionStatusRef.current !== 'idle') {
            return;
        }
        try {
            const defaults = await loadNewInstanceDefaults(seed);
            setNewInstanceRequest({ selfInvite, defaults });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t(
                          'dialog.world.toast.failed_to_load_new_instance_settings'
                      )
            );
        }
    }

    function saveNewInstanceDraft(form: any) {
        if (!form || typeof form !== 'object') {
            return;
        }
        Promise.all([
            configRepository.setString(
                'instanceDialogAccessType',
                form.accessType || 'public'
            ),
            configRepository.setString(
                'instanceRegion',
                form.region || 'US West'
            ),
            configRepository.setString(
                'instanceDialogInstanceName',
                form.instanceName || ''
            ),
            configRepository.setString(
                'instanceDialogUserId',
                form.legacyUserId === currentUserId
                    ? ''
                    : form.legacyUserId || ''
            ),
            configRepository.setString(
                'instanceDialogGroupId',
                form.groupId || ''
            ),
            configRepository.setString(
                'instanceDialogGroupAccessType',
                form.groupAccessType || 'plus'
            ),
            configRepository.setBool(
                'instanceDialogQueueEnabled',
                Boolean(form.queueEnabled)
            ),
            configRepository.setBool(
                'instanceDialogAgeGate',
                Boolean(form.ageGate)
            ),
            configRepository.setString(
                'instanceDialogDisplayName',
                form.displayName || ''
            )
        ]).catch(() => {});
    }

    async function createWorldInstance(form: any) {
        if (
            !newInstanceRequest ||
            !world.id ||
            actionStatusRef.current !== 'idle'
        ) {
            return;
        }
        const shouldSelfInvite = Boolean(newInstanceRequest.selfInvite);
        const targetWorldId = world.id;
        const targetEndpoint = currentEndpoint;
        if (form.accessType === 'group' && !normalizeEntityId(form.groupId)) {
            toast.error(
                t('dialog.world.error.group_id_is_required_for_group_instances')
            );
            return;
        }

        actionStatusRef.current = 'new-instance';
        setActionStatus('new-instance');
        try {
            await Promise.all([
                configRepository.setString(
                    'instanceDialogAccessType',
                    form.accessType || 'public'
                ),
                configRepository.setString(
                    'instanceRegion',
                    form.region || 'US West'
                ),
                configRepository.setString(
                    'instanceDialogGroupId',
                    form.groupId || ''
                ),
                configRepository.setString(
                    'instanceDialogGroupAccessType',
                    form.groupAccessType || 'plus'
                ),
                configRepository.setBool(
                    'instanceDialogAgeGate',
                    Boolean(form.ageGate)
                ),
                configRepository.setBool(
                    'instanceDialogQueueEnabled',
                    Boolean(form.queueEnabled)
                ),
                configRepository.setString(
                    'instanceDialogDisplayName',
                    form.displayName || ''
                )
            ]);
            const selectedGroup = findGroupOption(
                newInstanceGroups,
                form.groupId
            );
            const response = await vrchatInstanceRepository.createInstance({
                worldId: world.id,
                ownerId: currentUserId,
                accessType: form.accessType || 'public',
                region: form.region || 'US West',
                groupId: form.groupId || '',
                groupAccessType: form.groupAccessType || 'plus',
                queueEnabled: Boolean(form.queueEnabled),
                ageGate: Boolean(form.ageGate),
                roleIds: parseRoleIds(form.roleIds),
                displayName: normalizeEntityId(form.displayName),
                endpoint: currentEndpoint
            });
            const location = resolveInstanceLocation(world.id, response.json);
            if (!location) {
                throw new Error(
                    t(
                        'dialog.world.label.the_instance_was_created_but_vrchat_did_not_return_a_launch_location'
                    )
                );
            }
            const created = await resolveCreatedInstanceDetails(
                location,
                response.json,
                currentEndpoint,
                {
                    accessType: form.accessType || 'public',
                    ownerId:
                        form.accessType === 'group'
                            ? normalizeEntityId(form.groupId)
                            : currentUserId,
                    groupId:
                        form.accessType === 'group'
                            ? normalizeEntityId(form.groupId)
                            : '',
                    group: selectedGroup
                }
            );
            if (!isCurrentWorldTarget(targetWorldId, targetEndpoint)) {
                toast.success(t('dialog.world.success.instance_created'));
                return;
            }
            setNewInstanceRequest((current: any) => ({
                ...(current || {}),
                selfInvite: Boolean(current?.selfInvite),
                defaults: form,
                created
            }));

            if (shouldSelfInvite) {
                const parsedLocation = parseLocation(location);
                if (!parsedLocation.worldId || !parsedLocation.instanceId) {
                    toast.error(
                        t(
                            'dialog.world.label.instance_created_but_the_new_instance_location_is_not_inviteable'
                        )
                    );
                } else {
                    try {
                        await selfInviteToInstance(
                            location,
                            created.shortName ||
                                created.secureOrShortName ||
                                '',
                            currentEndpoint
                        );
                        toast.success(
                            t(
                                'dialog.world.success.instance_created_and_self_invite_sent'
                            )
                        );
                    } catch (error) {
                        toast.error(
                            error instanceof Error
                                ? t(
                                      'dialog.world.toast.instance_created_but_self_invite_failed_value',
                                      { value: error.message }
                                  )
                                : t(
                                      'dialog.world.toast.instance_created_but_self_invite_failed'
                                  )
                        );
                    }
                }
            } else {
                toast.success(t('dialog.world.success.instance_created'));
            }
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('message.instance.create_failed')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    async function copyCreatedInstance(created: any) {
        if (!created?.url) {
            return;
        }
        await copyTextToClipboard(created.url);
        toast.success(t('dialog.world.success.instance_url_copied'));
    }

    async function selfInviteCreatedInstance(created: any) {
        const parsedLocation = parseLocation(created?.location || '');
        if (!parsedLocation.worldId || !parsedLocation.instanceId) {
            toast.error(
                t(
                    'dialog.world.error.cannot_self_invite_location_is_not_a_concrete_instance'
                )
            );
            return;
        }
        actionStatusRef.current = 'new-instance';
        setActionStatus('new-instance');
        try {
            await selfInviteToInstance(
                created.location,
                created.shortName || created.secureOrShortName || '',
                currentEndpoint
            );
            toast.success(t('message.invite.self_sent'));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_send_self_invite')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    function inviteCreatedInstance(created: any) {
        if (!created?.location) {
            return;
        }
        setInviteRequest({
            location: created.location,
            launchToken: created.shortName || created.secureOrShortName || '',
            worldName: world?.name || created.location
        });
    }

    function launchCreatedInstance(created: any) {
        if (!created?.location) {
            return;
        }
        showLaunchDialog(
            created.location,
            created.shortName || '',
            created.secureOrShortName || '',
            {
                createdInstance: created,
                worldName: world?.name || ''
            }
        );
    }

    async function openCreatedInstanceInGame(created: any) {
        if (!created?.location) {
            return;
        }
        const parsedLocation = parseLocation(created.location);
        if (!parsedLocation.worldId || !parsedLocation.instanceId) {
            toast.error(
                t(
                    'dialog.world.error.cannot_open_in_vrchat_location_is_not_a_concrete_instance'
                )
            );
            return;
        }
        actionStatusRef.current = 'new-instance';
        setActionStatus('new-instance');
        try {
            const opened = await tryOpenLaunchLocation(
                created.location,
                created.shortName || created.secureOrShortName || '',
                currentEndpoint
            );
            if (!opened) {
                await selfInviteToInstance(
                    created.location,
                    created.shortName || created.secureOrShortName || '',
                    currentEndpoint
                );
                toast.warning(
                    t(
                        'dialog.world.error.failed_open_instance_in_vrchat_falling_back_to_self_invite'
                    )
                );
                toast.success(t('message.invite.self_sent'));
                return;
            }
            toast.success(t('dialog.world.success.vrchat_launch_request_sent'));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_open_instance_in_vrchat')
            );
        } finally {
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    function beginWorldImageUpload() {
        if (!canManageWorld || actionStatusRef.current !== 'idle') {
            return;
        }
        imageUploadWorldRef.current = world;
        imageUploadInputRef.current?.click();
    }

    function onFileChangeWorldImage(event: any) {
        const file = event.target.files?.[0] || null;
        event.target.value = '';
        if (!file) {
            return;
        }
        const validation = validateImageUploadFile(file);
        if (!validation.ok) {
            const message =
                validation.reason === 'too_large'
                    ? t('dialog.world.error.selected_image_is_too_large')
                    : t('dialog.world.error.selected_file_is_not_an_image');
            setDetail(message);
            toast.error(message);
            return;
        }
        const selectedWorld = imageUploadWorldRef.current || world;
        if (!selectedWorld?.id) {
            return;
        }
        imageUploadWorldRef.current = selectedWorld;
        setImageCropRequest({
            file,
            world: selectedWorld
        });
    }

    async function confirmWorldImageUpload(blob: any) {
        const request = imageCropRequest;
        const selectedWorld =
            request?.world || imageUploadWorldRef.current || world;
        const selectedWorldId = normalizeEntityId(selectedWorld?.id);
        const requestEndpoint = currentEndpoint;
        if (!blob || !selectedWorldId) {
            return;
        }

        actionStatusRef.current = 'image-upload';
        setActionStatus('image-upload');
        try {
            const base64Body = await readFileAsBase64(blob);
            const base64File =
                await mediaRepository.resizeImageToFitLimits(base64Body);
            const result = await withUploadTimeout(
                mediaRepository.uploadWorldImageLegacy({
                    worldId: selectedWorldId,
                    imageUrl:
                        selectedWorld.imageUrl ||
                        selectedWorld.thumbnailImageUrl ||
                        '',
                    base64File,
                    blob,
                    endpoint: requestEndpoint
                })
            );
            const activeTarget = activeWorldTargetRef.current;
            if (
                activeTarget.worldId !== selectedWorldId ||
                activeTarget.endpoint !== requestEndpoint
            ) {
                return;
            }
            setWorld(worldProfileRepository.normalize(result.world));
            setDetail(
                t('dialog.world.dynamic.world_image_updated_for_value', {
                    value: selectedWorld.name || selectedWorldId
                })
            );
            toast.success(t('dialog.world.success.world_image_updated'));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t('dialog.world.toast.failed_to_upload_world_image');
            setDetail(message);
            toast.error(message);
        } finally {
            imageUploadWorldRef.current = null;
            setImageCropRequest(null);
            actionStatusRef.current = 'idle';
            setActionStatus('idle');
        }
    }

    function openScreenshotMetadata(path: any) {
        if (!path) {
            return;
        }
        const params = new URLSearchParams();
        params.set('path', path);
        closeDialog();
        navigate(`/tools/screenshot-metadata?${params.toString()}`);
    }

    return (
        <>
            <WorldDialogTabbedView
                world={worldForView}
                resource={{
                    memo,
                    detail,
                    imageUrl,
                    actionStatus,
                    normalizedWorldId,
                    openNonce,
                    previousInstances
                }}
                permissions={{
                    isInstanceLocation,
                    worldDialogShortName,
                    isHomeWorld,
                    canUpdateHome,
                    canManageWorld,
                    hasPersistData
                }}
                worldControls={{
                    onRefresh: () => {
                        refreshWorldProfile();
                    },
                    onLaunch: () => {
                        launchInstance();
                    },
                    onHome: () => {
                        updateHomeLocation();
                    },
                    onEditMemo: () => {
                        editMemo();
                    },
                    onSaveMemo: (nextMemo: any) => saveMemo(nextMemo),
                    onOpenCache: () => {
                        openWorldCacheFolder();
                    },
                    onDeleteCache: () => {
                        deleteWorldCache();
                    },
                    onEditDetails: () => setOwnerEditor('details'),
                    onChangeTags: () => {
                        ownerActions.changeWorldTags();
                    },
                    onChangeAllowedDomains: () => {
                        ownerActions.changeWorldAllowedDomains();
                    },
                    onChangeImage: () => {
                        beginWorldImageUpload();
                    },
                    onNewInstance: () => {
                        openNewInstanceDialog(false);
                    },
                    onNewInstanceSelfInvite: () => {
                        openNewInstanceDialog(true);
                    },
                    onPublication: (nextPublished: any) => {
                        ownerActions.updateWorldPublication(nextPublished);
                    },
                    onDeletePersistentData: () => {
                        ownerActions.deleteWorldPersistentData();
                    },
                    onDelete: () => {
                        ownerActions.deleteWorld();
                    },
                    onOpenScreenshot: openScreenshotMetadata,
                    onPreviousInstancesChange: setPreviousInstances
                }}
            />
            <WorldNewInstanceDialog
                open={Boolean(newInstanceRequest)}
                request={newInstanceRequest}
                world={world}
                currentUserId={currentUserId}
                groupOptions={newInstanceGroups}
                submitting={actionStatus === 'new-instance'}
                onOpenChange={(open: any) => {
                    if (!open && actionStatus !== 'new-instance') {
                        setNewInstanceRequest(null);
                    }
                }}
                onChange={saveNewInstanceDraft}
                onSubmit={(form: any) => {
                    createWorldInstance(form);
                }}
                onCopy={(created: any) => {
                    copyCreatedInstance(created);
                }}
                onSelfInvite={(created: any) => {
                    selfInviteCreatedInstance(created);
                }}
                onInvite={inviteCreatedInstance}
                onLaunch={launchCreatedInstance}
                onOpenInGame={(created: any) => {
                    openCreatedInstanceInGame(created);
                }}
            />
            <InstanceInviteDialog
                open={Boolean(inviteRequest)}
                location={inviteRequest?.location || ''}
                launchToken={inviteRequest?.launchToken || ''}
                worldName={inviteRequest?.worldName || world?.name || ''}
                endpoint={currentEndpoint}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setInviteRequest(null);
                    }
                }}
            />
            <Input
                ref={imageUploadInputRef}
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                className="hidden"
                onChange={onFileChangeWorldImage}
            />
            <ImageCropDialog
                open={Boolean(imageCropRequest)}
                file={imageCropRequest?.file || null}
                aspectRatio={4 / 3}
                title={t('dialog.world.action.change_world_image')}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setImageCropRequest(null);
                        imageUploadWorldRef.current = null;
                    }
                }}
                onConfirm={(blob: any) => confirmWorldImageUpload(blob)}
            />
            <WorldDetailsDialog
                open={ownerEditor === 'details'}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setOwnerEditor('');
                    }
                }}
                world={world}
                saving={actionStatus === 'save-world'}
                onSave={(draft: any) => {
                    ownerActions.saveWorldDetails(draft);
                }}
            />
            <WorldTagsDialog
                open={ownerEditor === 'tags'}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setOwnerEditor('');
                    }
                }}
                world={world}
                saving={actionStatus === 'save-world'}
                onSave={(tags: any) => {
                    ownerActions.saveWorldTags(tags);
                }}
            />
            <WorldAllowedDomainsDialog
                open={ownerEditor === 'allowed-domains'}
                onOpenChange={(open: any) => {
                    if (!open) {
                        setOwnerEditor('');
                    }
                }}
                world={world}
                saving={actionStatus === 'save-world'}
                onSave={(urlList: any) => {
                    ownerActions.saveWorldAllowedDomains(urlList);
                }}
            />
        </>
    );
}
