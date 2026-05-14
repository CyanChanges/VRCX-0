import { useCallback, useMemo, useRef, useState } from 'react';

import {
    getTodayKey
} from './instance-activity/instanceActivityDate';
import {
    buildChartRows,
    buildDetailGroups,
    filterDetailGroups,
    getActivityDetailKey
} from './instance-activity/instanceActivityRows';
import { useInstanceActivityChartLifecycle } from './instance-activity/useInstanceActivityChartLifecycle';
import { useInstanceActivityData } from './instance-activity/useInstanceActivityData';
import { useInstanceActivityPreviousInstancesDialog } from './instance-activity/useInstanceActivityPreviousInstancesDialog';
import { useInstanceActivityRuntime } from './instance-activity/useInstanceActivityRuntime';
import { useInstanceActivitySettings } from './instance-activity/useInstanceActivitySettings';

export function useInstanceActivityPageController() {
    const {
        currentEndpoint,
        currentUserId,
        favoriteIdSet,
        friendIdSet,
        hour12,
        resolvedTheme
    } = useInstanceActivityRuntime();
    const [selectedDate, setSelectedDate] = useState(getTodayKey);
    const [reloadToken, setReloadToken] = useState(0);
    const detailGroupRefs = useRef(new Map());
    const settings = useInstanceActivitySettings();
    const data = useInstanceActivityData({
        currentEndpoint,
        currentUserId,
        reloadToken,
        selectedDate
    });
    const chartRows = useMemo(
        () =>
            buildChartRows(
                data.rawRows,
                selectedDate,
                currentUserId,
                data.worldDetailsById
            ),
        [currentUserId, data.rawRows, selectedDate, data.worldDetailsById]
    );
    const detailGroups = useMemo(
        () =>
            buildDetailGroups(
                data.rawRows,
                chartRows,
                currentUserId,
                friendIdSet,
                favoriteIdSet
            ),
        [chartRows, currentUserId, favoriteIdSet, friendIdSet, data.rawRows]
    );
    const filteredDetailGroups = useMemo(
        () =>
            filterDetailGroups(detailGroups, {
                isDetailVisible: settings.isDetailVisible,
                isSoloInstanceVisible: settings.isSoloInstanceVisible,
                isNoFriendInstanceVisible: settings.isNoFriendInstanceVisible
            }),
        [
            detailGroups,
            settings.isDetailVisible,
            settings.isNoFriendInstanceVisible,
            settings.isSoloInstanceVisible
        ]
    );
    const totalOnlineTime = useMemo(
        () =>
            chartRows.reduce((total: any, row: any) => total + row.visibleDurationMs, 0),
        [chartRows]
    );
    const previousInstances = useInstanceActivityPreviousInstancesDialog();
    const handleChartYAxisClick = useCallback((row: any) => {
        const target = detailGroupRefs.current.get(
            getActivityDetailKey(row?.location, row?.joinMs)
        );
        target?.scrollIntoView?.({
            behavior: 'smooth',
            block: 'start'
        });
    }, []);
    const chartLifecycle = useInstanceActivityChartLifecycle({
        barWidth: settings.barWidth,
        chartRows,
        hour12,
        onYAxisClick: handleChartYAxisClick,
        resolvedTheme,
        selectedDate
    });

    function handleRefresh() {
        setReloadToken((value: any) => value + 1);
    }

    return {
        actions: {
            refresh: handleRefresh
        },
        chart: {
            chartRows,
            hour12,
            resolvedTheme,
            setMainChartElementRef: chartLifecycle.setMainChartElementRef,
            totalOnlineTime,
            worldDetailsById: data.worldDetailsById
        },
        data: {
            availableDates: data.availableDates,
            detail: data.dataDetail,
            status: data.dataStatus
        },
        date: {
            selectedDate,
            setSelectedDate
        },
        detail: {
            currentUserId,
            detailGroupRefs,
            filteredDetailGroups
        },
        previousInstances,
        settings
    };
}
