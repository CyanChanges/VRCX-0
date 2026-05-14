import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useDashboardStore } from '@/state/dashboardStore';

export function useDashboardStoreState() {
    const { id = '' } = useParams();
    const dashboards = useDashboardStore((state: any) => state.dashboards);
    const loaded = useDashboardStore((state: any) => state.loaded);
    const loadStatus = useDashboardStore((state: any) => state.loadStatus);
    const detail = useDashboardStore((state: any) => state.detail);
    const ensureLoaded = useDashboardStore((state: any) => state.ensureLoaded);
    const consumeEditingDashboardId = useDashboardStore(
        (state: any) => state.consumeEditingDashboardId
    );
    const dashboard = dashboards.find((entry: any) => entry.id === id) || null;

    useEffect(() => {
        ensureLoaded().catch(() => {});
    }, [ensureLoaded]);

    return {
        consumeEditingDashboardId,
        dashboard,
        dashboards,
        detail,
        id,
        loaded,
        loadStatus
    };
}
