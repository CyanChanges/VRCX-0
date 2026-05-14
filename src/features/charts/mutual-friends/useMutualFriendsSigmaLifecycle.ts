import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    buildSigmaGraph,
    destroySigmaInstance,
    renderSigmaGraph
} from './mutualFriendsSigmaGraph';

export function useMutualFriendsSigmaLifecycle({
    filteredGraph,
    layoutSettings,
    resolvedTheme,
    selectedNodeId,
    selectedNodeIdRef,
    setSelectedNodeId
}: any) {
    const { t } = useTranslation();
    const chartElementRef = useRef<any>(null);
    const chartInstanceRef = useRef<any>(null);
    const resizeObserverRef = useRef<any>(null);
    const pendingRenderFrameRef = useRef(0);
    const [renderRetryToken, setRenderRetryToken] = useState(0);

    const setGraphElementRef = useCallback((node: any) => {
        if (chartElementRef.current && chartElementRef.current !== node) {
            destroySigmaInstance(chartInstanceRef, resizeObserverRef);
        }
        chartElementRef.current = node;
    }, []);

    useEffect(() => {
        return () => {
            if (pendingRenderFrameRef.current) {
                cancelAnimationFrame(pendingRenderFrameRef.current);
                pendingRenderFrameRef.current = 0;
            }
            destroySigmaInstance(chartInstanceRef, resizeObserverRef);
        };
    }, []);

    useEffect(() => {
        if (!filteredGraph.nodes.length) {
            destroySigmaInstance(chartInstanceRef, resizeObserverRef);
            return undefined;
        }

        const container = chartElementRef.current;
        if (!container) {
            return undefined;
        }

        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) {
            if (!pendingRenderFrameRef.current) {
                pendingRenderFrameRef.current = requestAnimationFrame(() => {
                    pendingRenderFrameRef.current = 0;
                    setRenderRetryToken((current: any) => current + 1);
                });
            }
            return undefined;
        }

        let active = true;
        const isDarkMode = resolvedTheme === 'dark';
        buildSigmaGraph({
            nodes: filteredGraph.nodes,
            links: filteredGraph.links,
            layoutSettings,
            selectedNodeId: selectedNodeIdRef.current
        })
            .then((graph: any) => {
                if (!active || chartElementRef.current !== container) {
                    return;
                }

                const nextRect = container.getBoundingClientRect();
                if (!nextRect.width || !nextRect.height) {
                    if (!pendingRenderFrameRef.current) {
                        pendingRenderFrameRef.current = requestAnimationFrame(
                            () => {
                                pendingRenderFrameRef.current = 0;
                                setRenderRetryToken(
                                    (current: any) => current + 1
                                );
                            }
                        );
                    }
                    return;
                }

                renderSigmaGraph({
                    graph,
                    container,
                    instanceRef: chartInstanceRef,
                    resizeObserverRef,
                    isDarkMode,
                    selectedNodeIdRef,
                    onSelectNode: setSelectedNodeId,
                    t
                });
            })
            .catch((error: any) => {
                if (active) {
                    console.warn(
                        '[MutualFriendsPage] Failed to render mutual graph.',
                        error
                    );
                }
            });

        return () => {
            active = false;
        };
    }, [
        filteredGraph.links,
        filteredGraph.nodes,
        layoutSettings,
        renderRetryToken,
        resolvedTheme,
        setSelectedNodeId,
        t
    ]);

    useEffect(() => {
        selectedNodeIdRef.current = selectedNodeId;
        chartInstanceRef.current?.refresh?.();
    }, [selectedNodeId]);

    function focusNode(nodeId: any) {
        const sigma = chartInstanceRef.current;
        sigma?.refresh?.();
        if (!nodeId || !sigma?.getNodeDisplayData?.(nodeId)) {
            return;
        }
        const displayData = sigma.getNodeDisplayData(nodeId);
        sigma.getCamera?.()?.animate?.(
            {
                x: displayData.x,
                y: displayData.y,
                ratio: 0.15
            },
            { duration: 300 }
        );
    }

    return {
        focusNode,
        setGraphElementRef
    };
}
