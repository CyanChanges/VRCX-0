import type { Column } from '@tanstack/react-table';
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    CopyIcon,
    ExternalLinkIcon,
    GlobeIcon,
    UserIcon,
    UsersIcon
} from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useKnownUserFact } from '@/domain/users/useKnownUser';
import { formatDateFilter } from '@/lib/dateTime';
import { cn } from '@/lib/utils';
import { copyTextToClipboard } from '@/services/entityMediaService';
import userProfileRepository from '@/repositories/userProfileRepository';
import {
    openGroupDialog,
    openUserDialog,
    openWorldDialog
} from '@/services/dialogService';
import {
    parseLocation,
    resolveFriendPresenceLocation
} from '@/shared/utils/location';
import { useFriendRosterStore } from '@/state/friendRosterStore';
import { useRuntimeStore } from '@/state/runtimeStore';
import { Button } from '@/ui/shadcn/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from '@/ui/shadcn/context-menu';

import {
    canRequestInviteFromFeedFriend,
    normalizeFeedId as normalizeId,
    resolveFeedUserDisplayName,
    resolveFeedUserId,
    UNKNOWN_FEED_USER_DISPLAY_NAME
} from '../feedRows';
import type { FeedFriendActions, FeedRow } from '../feedTypes';
import { FeedDetailCell } from './FeedDetailCell';
import { FeedExpandedRow } from './FeedExpandedRow';

function resolvePresenceLocation(profile: unknown) {
    return resolveFriendPresenceLocation(profile);
}

function formatTimestamp(value: unknown) {
    if (!value) {
        return '-';
    }

    return formatDateFilter(value, 'short');
}

function formatTimestampLong(value: unknown) {
    if (!value) {
        return '-';
    }

    return formatDateFilter(value, 'long');
}

async function copyFeedText(text: unknown, successMessage: string) {
    const value = String(text || '').trim();
    if (!value) {
        return;
    }
    await copyTextToClipboard(value);
    toast.success(successMessage);
}

function SortButton({
    column,
    label
}: {
    column: Column<FeedRow, unknown>;
    label: string;
}) {
    const direction = column.getIsSorted();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto justify-start gap-1 px-1 py-0 text-left text-xs font-medium tracking-wide uppercase"
            onClick={() => column.toggleSorting(direction === 'asc')}
        >
            <span>{label}</span>
            {direction === 'asc' ? (
                <ArrowUpIcon data-icon="inline-end" />
            ) : direction === 'desc' ? (
                <ArrowDownIcon data-icon="inline-end" />
            ) : (
                <ArrowUpDownIcon data-icon="inline-end" />
            )}
        </Button>
    );
}

function FeedUserLink({
    actions,
    cachedDisplayName = '',
    className = '',
    row
}: {
    actions: FeedFriendActions;
    cachedDisplayName?: string;
    className?: string;
    row: FeedRow;
}) {
    const { t } = useTranslation();
    const userId = resolveFeedUserId(row);
    const currentEndpoint = useRuntimeStore(
        (state: any) => state.auth.currentUserEndpoint
    );
    const currentUserId = useRuntimeStore(
        (state: any) => state.auth.currentUserId
    );
    const currentUserSnapshot = useRuntimeStore(
        (state: any) => state.auth.currentUserSnapshot
    );
    const friend = useFriendRosterStore((state: any) =>
        userId ? state.friendsById[userId] || null : null
    );
    const knownUser = useKnownUserFact(userId, { endpoint: currentEndpoint });
    const displayUser = friend
        ? {
              ...(knownUser || {}),
              ...friend,
              displayName: friend.displayName || knownUser?.displayName,
              username: friend.username || knownUser?.username
          }
        : knownUser;
    const displayName = resolveFeedUserDisplayName(
        row,
        displayUser,
        cachedDisplayName
    );
    const location = resolvePresenceLocation(friend || knownUser);
    const parsedLocation = parseLocation(location);
    const worldTarget = parsedLocation.worldId || '';
    const worldDialogTarget =
        parsedLocation.isRealInstance && parsedLocation.tag
            ? parsedLocation.tag
            : worldTarget;
    const groupTarget = parsedLocation.groupId || '';
    const isCurrentUser = Boolean(
        userId && userId === normalizeId(currentUserId)
    );
    const canRequestInvite = canRequestInviteFromFeedFriend(
        friend,
        currentUserSnapshot
    );
    const canUseFriendLocation = Boolean(
        !isCurrentUser &&
        parsedLocation.isRealInstance &&
        parsedLocation.worldId &&
        parsedLocation.instanceId &&
        actions.canUseFeedFriendLocation(location)
    );

    useEffect(() => {
        if (!userId || displayName !== UNKNOWN_FEED_USER_DISPLAY_NAME) {
            return;
        }

        userProfileRepository
            .getUserProfile({ userId, endpoint: currentEndpoint })
            .catch(() => {});
    }, [currentEndpoint, displayName, userId]);

    const userLabel = displayName || UNKNOWN_FEED_USER_DISPLAY_NAME;
    const actionTarget = (friend || row) as FeedRow;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                        'hover:text-primary h-auto max-w-full justify-start self-start text-left font-medium',
                        className
                    )}
                    disabled={!userId}
                    onClick={() =>
                        openUserDialog({
                            userId,
                            title: userLabel,
                            seedData: displayUser || null
                        })
                    }
                >
                    <span className="max-w-full truncate">{userLabel}</span>
                </Button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-56">
                <ContextMenuGroup>
                    <ContextMenuItem
                        disabled={!userId}
                        onSelect={() =>
                            openUserDialog({
                                userId,
                                title: userLabel,
                                seedData: displayUser || null
                            })
                        }
                    >
                        <UserIcon />
                        {t('table.playerList.user')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!worldTarget}
                        onSelect={() =>
                            openWorldDialog({
                                worldId: worldDialogTarget,
                                title: friend?.worldName || worldTarget
                            })
                        }
                    >
                        <GlobeIcon />
                        {t('table.playerList.location')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!groupTarget}
                        onSelect={() =>
                            openGroupDialog({
                                groupId: groupTarget,
                                title: undefined
                            })
                        }
                    >
                        <UsersIcon />
                        {t('side_panel.groups')}
                    </ContextMenuItem>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                    <ContextMenuItem
                        disabled={!canUseFriendLocation}
                        onSelect={() => {
                            actions.launchFeedFriendLocation(location);
                        }}
                    >
                        <ExternalLinkIcon />
                        {t('dialog.launch.open_ingame')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={!canUseFriendLocation}
                        onSelect={() => {
                            actions.selfInviteFeedFriendLocation(location);
                        }}
                    >
                        <ExternalLinkIcon />
                        {t('dialog.launch.self_invite')}
                    </ContextMenuItem>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                    <ContextMenuItem
                        disabled={
                            isCurrentUser || !actions.canSendInviteFromFeed
                        }
                        onSelect={() => {
                            actions.sendFeedFriendInvite(actionTarget);
                        }}
                    >
                        <ExternalLinkIcon />
                        {t('dialog.user.actions.invite')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={isCurrentUser || !canRequestInvite}
                        onSelect={() => {
                            actions.requestFeedFriendInvite(actionTarget);
                        }}
                    >
                        <ExternalLinkIcon />
                        {t('dialog.user.actions.request_invite')}
                    </ContextMenuItem>
                    <ContextMenuItem
                        disabled={isCurrentUser || !actions.canBoopFromFeed}
                        onSelect={() => {
                            actions.sendFeedFriendBoop(actionTarget);
                        }}
                    >
                        <ExternalLinkIcon />
                        {t('dialog.user.actions.send_boop')}
                    </ContextMenuItem>
                </ContextMenuGroup>
                <ContextMenuSeparator />
                <ContextMenuGroup>
                    <ContextMenuItem
                        disabled={!displayName}
                        onSelect={() => {
                            copyFeedText(
                                displayName,
                                t('view.feed.dynamic.value_copied', {
                                    value: 'Display name'
                                })
                            );
                        }}
                    >
                        <CopyIcon />
                        {t('dialog.user.info.copy_display_name')}
                    </ContextMenuItem>
                </ContextMenuGroup>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export {
    FeedDetailCell,
    FeedExpandedRow,
    FeedUserLink,
    SortButton,
    formatTimestamp,
    formatTimestampLong
};
