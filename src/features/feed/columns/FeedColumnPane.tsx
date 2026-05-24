import {
    ArrowUpToLineIcon,
    GripVerticalIcon,
    MoreHorizontalIcon,
    SettingsIcon,
    Trash2Icon
} from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { FeedTimeDisplayModePreference } from '@/state/preferencesStore';
import { Button } from '@/ui/shadcn/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/ui/shadcn/dropdown-menu';
import { Spinner } from '@/ui/shadcn/spinner';

import { describeFeedColumnScope } from '../feedColumnScope';
import type { FeedColumnConfig } from '../feedColumnsState';
import { getFeedRowId } from '../feedRows';
import type {
    FeedFriendActions,
    FeedLocationActionPayload,
    FeedRow
} from '../feedTypes';
import { FeedColumnItem } from './FeedColumnItem';
import { useFeedColumnRows } from './useFeedColumnRows';

const ITEM_STEP = 60;
const ITEM_HEIGHT = 60;
const OVERSCAN = 8;

type FeedColumnPaneProps = {
    actions: FeedFriendActions;
    column: FeedColumnConfig;
    dragHandleProps?: {
        attributes?: any;
        listeners?: any;
    };
    loadingPreviousInstancesKey: string;
    nowMs: number;
    onDelete(columnId: string): void;
    onEdit(columnId: string): void;
    onOpenPreviousInstances(payload?: FeedLocationActionPayload): void;
    timeDisplayMode: FeedTimeDisplayModePreference;
};

function useColumnViewport(rows: FeedRow[], loadOlder: () => void) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const previousRowsRef = useRef<FeedRow[]>(rows);
    const [viewport, setViewport] = useState({ height: 0, scrollTop: 0 });
    const totalHeight = rows.length * ITEM_STEP;

    useLayoutEffect(() => {
        const element = viewportRef.current;
        const previousRows = previousRowsRef.current;
        previousRowsRef.current = rows;
        if (!element || element.scrollTop <= ITEM_STEP || !previousRows.length) {
            return;
        }
        const previousIndex = Math.floor(element.scrollTop / ITEM_STEP);
        const previousKey = previousRows[previousIndex]
            ? getFeedRowId(previousRows[previousIndex])
            : '';
        if (!previousKey) {
            return;
        }
        const nextIndex = rows.findIndex((row) => getFeedRowId(row) === previousKey);
        if (nextIndex < 0 || nextIndex === previousIndex) {
            return;
        }
        const offset = element.scrollTop - previousIndex * ITEM_STEP;
        element.scrollTop = nextIndex * ITEM_STEP + offset;
    }, [rows]);

    useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return undefined;
        }
        let frameId = 0;
        const updateViewport = () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
            frameId = requestAnimationFrame(() => {
                frameId = 0;
                setViewport({
                    height: element.clientHeight,
                    scrollTop: element.scrollTop
                });
            });
        };

        updateViewport();
        element.addEventListener('scroll', updateViewport, { passive: true });
        const observer =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(updateViewport)
                : null;
        observer?.observe(element);
        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
            observer?.disconnect();
            element.removeEventListener('scroll', updateViewport);
        };
    }, []);

    useEffect(() => {
        if (!viewport.height || !rows.length) {
            return;
        }
        if (viewport.scrollTop + viewport.height >= totalHeight - ITEM_STEP * 8) {
            loadOlder();
        }
    }, [loadOlder, rows.length, totalHeight, viewport.height, viewport.scrollTop]);

    const virtualItems = useMemo(() => {
        const firstIndex = Math.max(
            0,
            Math.floor(viewport.scrollTop / ITEM_STEP) - OVERSCAN
        );
        const lastIndex = Math.min(
            rows.length,
            Math.ceil((viewport.scrollTop + viewport.height) / ITEM_STEP) + OVERSCAN
        );
        return rows.slice(firstIndex, lastIndex).map((row, offset) => {
            const index = firstIndex + offset;
            return {
                index,
                key: getFeedRowId(row),
                row,
                top: index * ITEM_STEP
            };
        });
    }, [rows, viewport.height, viewport.scrollTop]);

    const scrollToLatest = () => {
        if (viewportRef.current) {
            viewportRef.current.scrollTop = 0;
        }
    };

    return {
        scrollToLatest,
        showLatestButton: viewport.scrollTop > ITEM_STEP,
        totalHeight,
        viewportRef,
        virtualItems
    };
}

export function FeedColumnPane({
    actions,
    column,
    dragHandleProps,
    loadingPreviousInstancesKey,
    nowMs,
    onDelete,
    onEdit,
    onOpenPreviousInstances,
    timeDisplayMode
}: FeedColumnPaneProps) {
    const { t } = useTranslation();
    const { hasMore, loadOlder, loadingOlder, loadStatus, rows } =
        useFeedColumnRows(column);
    const {
        scrollToLatest,
        showLatestButton,
        totalHeight,
        viewportRef,
        virtualItems
    } = useColumnViewport(rows, loadOlder);
    const summary = describeFeedColumnScope(column, {
        allFavoritesLabel: t('view.feed.columns.all_favorites'),
        allFriendsLabel: t('view.feed.columns.all_friends'),
        groupCountLabel: (count) =>
            t('view.feed.columns.groups_count', { count }),
        typeLabel: (type) => t(`view.feed.filters.${type}`)
    });

    return (
        <section
            className="border-border/40 bg-card/10 group/feed-column relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border"
            style={{ width: column.width }}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-9 z-20 shrink-0 cursor-grab opacity-0 transition-opacity group-hover/feed-column:opacity-100 focus-visible:opacity-100"
                aria-label={t('nav_menu.custom_nav.dynamic.drag_value', {
                    value: column.title
                })}
                {...dragHandleProps?.attributes}
                {...dragHandleProps?.listeners}
            >
                <GripVerticalIcon data-icon="icon" />
            </Button>
            <div className="border-border/60 bg-muted/10 flex shrink-0 flex-col gap-1 border-b px-3 py-1.5">
                <div className="flex min-w-0 items-center gap-1">
                    <div className="min-w-0 flex-1 text-left">
                        <div className="text-foreground truncate text-sm font-semibold">
                            {column.title}
                        </div>
                        <div className="text-muted-foreground truncate text-[11px]">
                            {summary}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('accessibility.more')}
                            >
                                <MoreHorizontalIcon data-icon="icon" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    onClick={() => onEdit(column.id)}
                                >
                                    <SettingsIcon data-icon="inline-start" />
                                    {t('common.actions.configure')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => onDelete(column.id)}
                                >
                                    <Trash2Icon data-icon="inline-start" />
                                    {t('common.actions.delete')}
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="relative min-h-0 flex-1">
                {showLatestButton ? (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="bg-popover/95 absolute top-2 left-1/2 z-20 h-7 -translate-x-1/2 rounded-full border px-3 text-xs shadow-md backdrop-blur"
                        onClick={scrollToLatest}
                    >
                        <ArrowUpToLineIcon data-icon="inline-start" />
                        {t('view.feed.columns.latest')}
                    </Button>
                ) : null}
                <div
                    ref={viewportRef}
                    className={cn(
                        'h-full min-h-0 overflow-y-auto px-0.5',
                        loadStatus === 'error' && 'text-destructive'
                    )}
                >
                    {loadStatus === 'running' ? (
                        <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
                            <Spinner />
                            {t('view.feed.loading.loading_feed_rows')}
                        </div>
                    ) : rows.length ? (
                        <div className="relative" style={{ height: totalHeight }}>
                            {virtualItems.map((item) => (
                                <div
                                    key={item.key}
                                    className="absolute right-0 left-0"
                                    style={{
                                        height: ITEM_HEIGHT,
                                        top: item.top
                                    }}
                                >
                                    <FeedColumnItem
                                        actions={actions}
                                        column={column}
                                        loadingPreviousInstancesKey={
                                            loadingPreviousInstancesKey
                                        }
                                        nowMs={nowMs}
                                        onOpenPreviousInstances={
                                            onOpenPreviousInstances
                                        }
                                        row={item.row}
                                        timeDisplayMode={timeDisplayMode}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">
                            {loadStatus === 'error'
                                ? t('view.feed.error.feed_query_failed')
                                : t(
                                      'view.feed.empty.no_feed_rows_match_the_current_filters'
                                  )}
                        </div>
                    )}
                    {loadingOlder ? (
                        <div className="text-muted-foreground flex justify-center py-2">
                            <Spinner />
                        </div>
                    ) : null}
                    {!hasMore && rows.length ? <div className="h-2" /> : null}
                </div>
            </div>
        </section>
    );
}
