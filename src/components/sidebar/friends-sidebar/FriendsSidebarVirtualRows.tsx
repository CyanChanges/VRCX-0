import { cn } from '@/lib/utils';
import { checkCanInviteSelf } from '@/shared/utils/invite';
import { Skeleton } from '@/ui/shadcn/skeleton';

import { FriendRow } from './FriendsSidebarFriendRow';
import {
    FriendSectionHeader,
    InstanceHeaderRow
} from './FriendsSidebarHeaders';
import {
    normalizeLocationStatus,
    readFriendRefLocation,
    readFriendStatusSource,
    resolvePresenceLocation
} from './friendsSidebarModel';

function FavoriteGroupHeaderRow({ label, count }: any) {
    return (
        <div className="text-muted-foreground flex w-full items-center px-1.5 py-1 text-left text-xs">
            {label} - {count}
        </div>
    );
}

function SidebarMessageRow({ className = '', text }: any) {
    return (
        <div
            className={cn(
                'text-muted-foreground rounded-md border border-dashed p-3 text-xs',
                className
            )}
        >
            {text}
        </div>
    );
}

function SidebarSkeletonRow() {
    return (
        <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="mt-2 h-3 w-4/5" />
            </div>
        </div>
    );
}

function FriendVirtualRow({
    appearance,
    friend,
    metadataKey = '',
    isCurrentUser = false,
    isGroupByInstance = false,
    friendCommands,
    location,
    runtime,
    statusCommands
}: any) {
    const source = readFriendStatusSource(friend);
    const state = normalizeLocationStatus(source?.stateBucket || source?.state);
    const isOnlineFriend =
        runtime.onlineIdSet.has(friend.id) || state === 'online';

    return (
        <FriendRow
            friend={friend}
            rowModel={{
                isCurrentUser,
                isGroupByInstance,
                canSendInvite: Boolean(
                    runtime.gameState.isGameRunning &&
                        runtime.currentInviteLocation &&
                        runtime.canInviteFromCurrentLocation
                ),
                canRequestInvite: isOnlineFriend,
                canBoop: Boolean(runtime.currentUser?.isBoopingEnabled),
                canUseFriendInstance: Boolean(
                    isOnlineFriend &&
                        checkCanInviteSelf(
                            isCurrentUser
                                ? resolvePresenceLocation(friend)
                                : readFriendRefLocation(friend),
                            {
                                currentUserId: runtime.currentUserId,
                                cachedInstances: new Map(),
                                friends: runtime.friendsMap
                            }
                        )
                )
            }}
            rowCommands={{
                onOpen: () => friendCommands.onOpenFriend(friend),
                onLaunch: friendCommands.onLaunch,
                onSelfInvite: friendCommands.onSelfInvite,
                onInvite: friendCommands.onInvite,
                onRequestInvite: friendCommands.onRequestInvite,
                onBoop: friendCommands.onBoop,
                onChangeStatus: statusCommands.onChangeStatus,
                onSetStatusDescription:
                    statusCommands.onSetStatusDescription,
                onEditStatusDescription:
                    statusCommands.onEditStatusDescription,
                onApplyStatusPreset: statusCommands.onApplyStatusPreset,
                statusPresets: isCurrentUser
                    ? statusCommands.statusPresets
                    : []
            }}
            appearance={{
                randomUserColours: appearance.randomUserColours,
                isDarkMode: appearance.isDarkMode,
                trustColor: appearance.trustColor,
                currentUserSnapshot: runtime.currentUser,
                isGameRunning: runtime.gameState.isGameRunning,
                recentActionVersion: appearance.recentActionVersion,
                locationMetadata:
                    location.locationMetadataByKey.get(metadataKey),
                showInstanceIdInLocation:
                    appearance.showInstanceIdInLocation,
                ageGatedInstancesVisible: appearance.ageGatedInstancesVisible
            }}
        />
    );
}

function FriendsSidebarVirtualRow({
    appearance,
    friendCommands,
    location,
    row,
    runtime,
    statusCommands
}: any) {
    switch (row?.type) {
        case 'section':
            return (
                <FriendSectionHeader
                    id={row.id}
                    title={row.title}
                    count={row.count}
                    open={row.open}
                    onToggle={friendCommands.onToggleSection}
                />
            );
        case 'favorite-group-header':
            return (
                <FavoriteGroupHeaderRow label={row.label} count={row.count} />
            );
        case 'instance-header':
            return (
                <InstanceHeaderRow
                    location={row.location}
                    count={row.count}
                    metadata={location.locationMetadataByKey.get(row.key)}
                    showInstanceIdInLocation={
                        appearance.showInstanceIdInLocation
                    }
                    ageGatedInstancesVisible={
                        appearance.ageGatedInstancesVisible
                    }
                />
            );
        case 'message':
            return (
                <SidebarMessageRow className={row.className} text={row.text} />
            );
        case 'skeleton':
            return <SidebarSkeletonRow />;
        case 'footer':
            return <div className="h-4" />;
        case 'friend':
        default:
            return (
                <FriendVirtualRow
                    appearance={appearance}
                    friend={row.friend}
                    isCurrentUser={row.isCurrentUser}
                    isGroupByInstance={row.isGroupByInstance}
                    metadataKey={row.key}
                    friendCommands={friendCommands}
                    location={location}
                    runtime={runtime}
                    statusCommands={statusCommands}
                />
            );
    }
}

export { FriendsSidebarVirtualRow };
