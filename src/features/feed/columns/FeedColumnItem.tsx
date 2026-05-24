import { ArrowRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedFilterType } from '@/repositories/feedRepository';
import type { FeedTimeDisplayModePreference } from '@/state/preferencesStore';
import { Button } from '@/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/ui/shadcn/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/shadcn/tooltip';

import { AvatarInfoLine } from '../components/FeedAvatarInfoLine';
import { formatDifferenceHtml } from '../components/FeedDifferenceHtml';
import { FeedLocationLink } from '../components/FeedLocationLink';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { FeedUserLink } from '../components/FeedTableParts';
import type { FeedColumnConfig } from '../feedColumnsState';
import { resolveFeedColumnTimeDisplay } from '../feedTimeDisplay';
import type {
    FeedFriendActions,
    FeedLocationActionPayload,
    FeedRow
} from '../feedTypes';

type FeedColumnItemProps = {
    actions: FeedFriendActions;
    column: FeedColumnConfig;
    loadingPreviousInstancesKey: string;
    nowMs: number;
    onOpenPreviousInstances(payload?: FeedLocationActionPayload): void;
    row: FeedRow;
    timeDisplayMode: FeedTimeDisplayModePreference;
};

function FeedColumnDetail({
    actions,
    loadingPreviousInstancesKey,
    onOpenBioDiff,
    onOpenPreviousInstances,
    row
}: FeedColumnItemProps & {
    onOpenBioDiff?(): void;
}) {
    const type = row?.type;

    if (type === 'GPS' || type === 'Online' || type === 'Offline') {
        return (
            <FeedLocationLink
                disableTooltip
                groupName={row?.groupName}
                loadingHistoryKey={loadingPreviousInstancesKey}
                location={row?.location}
                onNewInstance={actions.openFeedNewInstance}
                onOpenPreviousInstances={onOpenPreviousInstances}
                worldName={row?.worldName}
                className="text-xs"
            />
        );
    }

    if (type === 'Status') {
        if (row?.statusDescription === row?.previousStatusDescription) {
            return (
                <span className="flex min-w-0 items-center gap-1.5">
                    <FeedStatusBadge status={row?.previousStatus} />
                    <ArrowRightIcon className="text-muted-foreground size-3.5 shrink-0" />
                    <FeedStatusBadge status={row?.status} />
                </span>
            );
        }

        return (
            <span className="flex min-w-0 items-center gap-1.5">
                <FeedStatusBadge status={row?.status} />
                <span className="min-w-0 truncate">
                    {String(row?.statusDescription || '')}
                </span>
            </span>
        );
    }

    if (type === 'Avatar') {
        return (
            <div className="min-w-0 truncate">
                <AvatarInfoLine
                    avatarName={row?.avatarName}
                    avatarTags={row?.currentAvatarTags}
                    compact
                    imageUrl={row?.currentAvatarImageUrl}
                    ownerId={row?.ownerId}
                    showTags={false}
                    userId={row?.userId}
                />
            </div>
        );
    }

    if (type === 'Bio') {
        return (
            <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground h-auto w-full min-w-0 justify-start p-0 text-left text-xs font-normal"
                onClick={onOpenBioDiff}
            >
                <span className="block min-w-0 truncate">
                    {String(row?.bio || '')}
                </span>
            </Button>
        );
    }

    return (
        <span className="block min-w-0 truncate">
            {String(row?.message || '')}
        </span>
    );
}

function FeedColumnTypeHint({
    type,
    typeLabel
}: {
    type: string;
    typeLabel: string;
}) {
    if (
        type === 'Online' ||
        type === 'Offline' ||
        type === 'Avatar' ||
        type === 'Bio'
    ) {
        return (
            <span className="text-muted-foreground shrink-0 text-[10px] font-medium">
                {typeLabel || type}
            </span>
        );
    }

    return null;
}

function FeedColumnTime({
    label,
    showTypeHint,
    title,
    type,
    typeLabel
}: {
    label: string;
    showTypeHint: boolean;
    title: string;
    type: string;
    typeLabel: string;
}) {
    return (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {showTypeHint ? (
                <FeedColumnTypeHint type={type} typeLabel={typeLabel} />
            ) : null}
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                        {label}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{title}</TooltipContent>
            </Tooltip>
        </div>
    );
}

function shouldShowFeedColumnTypeHint(
    column: FeedColumnConfig,
    type: FeedFilterType | string
) {
    if (type === 'GPS' || type === 'Status') {
        return false;
    }
    if (type === 'Online' || type === 'Offline') {
        return true;
    }
    if (type === 'Avatar' || type === 'Bio') {
        return (column.feedTypes || []).some((feedType) => feedType !== type);
    }
    return false;
}

export function FeedColumnItem(props: FeedColumnItemProps) {
    const { column, nowMs, row, timeDisplayMode } = props;
    const { t } = useTranslation();
    const [bioDiffOpen, setBioDiffOpen] = useState(false);
    const type = String(row?.type || '');
    const typeLabel = type ? t(`view.feed.filters.${type}`) : '';
    const showTypeHint = shouldShowFeedColumnTypeHint(column, type);
    const bioDiffHtml = useMemo(
        () => formatDifferenceHtml(row?.previousBio, row?.bio),
        [row?.bio, row?.previousBio]
    );
    const time = resolveFeedColumnTimeDisplay({
        mode: timeDisplayMode,
        nowMs,
        t,
        value: row?.created_at
    });

    return (
        <>
            <div className="hover:bg-accent/20 border-border/35 flex h-[60px] min-w-0 flex-col justify-center gap-1 border-b px-2 py-1.5 transition-colors">
                <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <FeedUserLink
                            actions={props.actions}
                            className="h-5 min-w-0 flex-1 px-0 py-0 text-xs"
                            row={row}
                        />
                        {showTypeHint &&
                        (type === 'Online' || type === 'Offline') ? (
                            <FeedColumnTypeHint
                                type={type}
                                typeLabel={typeLabel}
                            />
                        ) : null}
                    </div>
                    <FeedColumnTime
                        label={time.label}
                        showTypeHint={
                            showTypeHint && (type === 'Avatar' || type === 'Bio')
                        }
                        title={time.title}
                        type={type}
                        typeLabel={typeLabel}
                    />
                </div>
                <div className="text-muted-foreground min-w-0 truncate text-xs leading-4">
                    <FeedColumnDetail
                        {...props}
                        onOpenBioDiff={() => setBioDiffOpen(true)}
                    />
                </div>
            </div>
            {type === 'Bio' ? (
                <Dialog open={bioDiffOpen} onOpenChange={setBioDiffOpen}>
                    <DialogContent className="w-[min(92vw,42rem)] sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {t('view.feed.columns.bio_diff')}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="bg-muted/20 max-h-[60vh] overflow-auto rounded-md border p-3">
                            <pre
                                className="font-inherit text-xs leading-5 whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                    __html: bioDiffHtml
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            ) : null}
        </>
    );
}
