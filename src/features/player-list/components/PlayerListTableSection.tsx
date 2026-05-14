import {
    getCoreRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TableColumnVisibilityMenu } from '@/components/data-table/TableColumnVisibilityMenu';
import { LoadingState } from '@/components/layout/PageScaffold';
import { userFacingErrorMessage } from '@/lib/errorDisplay';

import { usePlayerListTableState } from '../usePlayerListTableState';
import { usePlayerListColumns } from './PlayerListColumns';
import {
    PlayerListEmptyState,
    PlayerListRows,
    PlayerListTableShell
} from './PlayerListViewParts';

export function PlayerListTableSection({
    detail,
    filteredRows,
    gameLogDisabled,
    isGameRunning,
    isPlayerListSourceUnavailable,
    loadStatus,
    onOpenPlayer,
    parsedLocation,
    playerSourceRows
}: any) {
    const { t } = useTranslation();
    const tableState = usePlayerListTableState();
    const tableColumns = usePlayerListColumns();
    const table = useReactTable({
        data: filteredRows,
        columns: tableColumns,
        state: {
            columnOrder: tableState.columnOrder,
            columnSizing: tableState.columnSizing,
            columnVisibility: tableState.columnVisibility,
            sorting: tableState.sorting
        },
        onSortingChange: tableState.setSorting,
        onColumnVisibilityChange: tableState.setColumnVisibility,
        onColumnOrderChange: tableState.setColumnOrder,
        onColumnSizingChange: tableState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row: any) =>
            `${row?.userId || row?.id || ''}:${row?.displayName || ''}`,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        meta: {
            columnOrderLocked: tableState.columnOrderLocked,
            setColumnOrderLocked: tableState.setColumnOrderLocked
        }
    });

    const hasRows = filteredRows.length > 0;
    const isLoading = loadStatus === 'running' && playerSourceRows.length === 0;
    const isError = loadStatus === 'error' && playerSourceRows.length === 0;

    return (
        <div className="current-instance-table flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="mb-2 flex justify-end">
                <TableColumnVisibilityMenu
                    table={table}
                    onResetLayout={tableState.resetLayout}
                />
            </div>
            {isLoading ? (
                <LoadingState
                    label={t(
                        'view.player_list.label.rebuilding_the_current_instance_roster_from_game_log_history'
                    )}
                />
            ) : isError ? (
                <PlayerListEmptyState
                    title={t(
                        'view.player_list.error.current_players_failed_to_load'
                    )}
                    description={userFacingErrorMessage(
                        detail,
                        'Current players could not be rebuilt for the current instance.'
                    )}
                />
            ) : (
                <PlayerListTableShell
                    table={table}
                    onResetLayout={tableState.resetLayout}
                >
                    <PlayerListRows
                        table={table}
                        hasRows={hasRows}
                        onOpenPlayer={onOpenPlayer}
                        emptyTitle={
                            gameLogDisabled
                                ? 'Game log is disabled'
                                : !isGameRunning
                                  ? 'VRChat is not running'
                                  : isPlayerListSourceUnavailable
                                    ? 'Current players are not available yet'
                                    : parsedLocation.isTraveling
                                      ? 'Currently traveling between instances'
                                      : parsedLocation.isOffline
                                        ? 'No current instance detected'
                                        : 'No players reconstructed for this instance yet'
                        }
                        emptyDescription={
                            gameLogDisabled
                                ? 'Enable game log ingestion in settings before current players can be reconstructed.'
                                : !isGameRunning
                                  ? 'Start VRChat and let VRCX-0 receive game-log events before this page can rebuild the current instance.'
                                  : isPlayerListSourceUnavailable
                                    ? 'Stay in the instance until local join/leave events are recorded, then this table will populate automatically.'
                                    : parsedLocation.isTraveling
                                      ? 'Current players follow live instance locations. They will repopulate after the next location event lands.'
                                      : 'The local join/leave history does not have any current players for the active location yet.'
                        }
                    />
                </PlayerListTableShell>
            )}
        </div>
    );
}
