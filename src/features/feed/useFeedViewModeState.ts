import { useEffect, useRef, useState } from 'react';

import configRepository from '@/repositories/configRepository';

import {
    FEED_COLUMNS_DEFAULT_CONFIG,
    type FeedColumnConfig,
    type FeedViewMode,
    sanitizeFeedColumnsConfig,
    sanitizeFeedViewMode
} from './feedColumnsState';
import { safeJsonParse } from './feedTableState';

export function useFeedViewModeState() {
    const [ready, setReady] = useState(false);
    const [viewMode, setViewMode] = useState<FeedViewMode>('table');
    const [columns, setColumns] = useState<FeedColumnConfig[]>(() =>
        FEED_COLUMNS_DEFAULT_CONFIG.map((column) => ({ ...column }))
    );
    const hasWrittenModeRef = useRef(false);
    const hasWrittenColumnsRef = useRef(false);

    useEffect(() => {
        let active = true;
        Promise.all([
            configRepository.getString('feedViewMode', 'table'),
            configRepository.getString('feedColumnsConfig', '[]')
        ])
            .then(([savedMode, savedColumns]) => {
                if (!active) {
                    return;
                }
                setViewMode(sanitizeFeedViewMode(savedMode));
                setColumns(sanitizeFeedColumnsConfig(safeJsonParse(savedColumns)));
                setReady(true);
            })
            .catch(() => {
                if (active) {
                    setReady(true);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!ready) {
            return;
        }
        if (!hasWrittenModeRef.current) {
            hasWrittenModeRef.current = true;
            return;
        }
        configRepository.setString('feedViewMode', viewMode);
    }, [ready, viewMode]);

    useEffect(() => {
        if (!ready) {
            return;
        }
        if (!hasWrittenColumnsRef.current) {
            hasWrittenColumnsRef.current = true;
            return;
        }
        configRepository.setString('feedColumnsConfig', JSON.stringify(columns));
    }, [columns, ready]);

    return {
        columns,
        ready,
        setColumns,
        setViewMode,
        viewMode
    };
}
