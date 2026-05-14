import {
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table';

import { useFriendLogColumns } from './components/FriendLogColumns';
import { useFriendLogFilters } from './useFriendLogFilters';
import { useFriendLogRowActions } from './useFriendLogRowActions';
import { useFriendLogRows } from './useFriendLogRows';
import { useFriendLogShiftKey } from './useFriendLogShiftKey';
import { useFriendLogTableState } from './useFriendLogTableState';

export function useFriendLogPageController() {
    const filters = useFriendLogFilters();
    const rows = useFriendLogRows({
        refreshToken: filters.refreshToken,
        searchQuery: filters.searchQuery,
        selectedTypes: filters.selectedTypes
    });
    const tableState = useFriendLogTableState({
        hideUnfriends: rows.hideUnfriends,
        orderedRowsLength: rows.orderedRows.length,
        searchQuery: filters.searchQuery,
        selectedTypes: filters.selectedTypes
    });
    const shiftHeld = useFriendLogShiftKey();
    const rowActions = useFriendLogRowActions({
        currentUserId: rows.currentUserId,
        loadStatus: rows.loadStatus,
        rowsOwnerUserId: rows.rowsOwnerUserId,
        rowsOwnerUserIdRef: rows.rowsOwnerUserIdRef,
        setDetail: rows.setDetail,
        setRows: rows.setRows
    });
    const columns = useFriendLogColumns({
        currentUserId: rows.currentUserId,
        deletingRowKey: rowActions.deletingRowKey,
        handleDeleteRow: rowActions.handleDeleteRow,
        loadStatus: rows.loadStatus,
        rowsOwnerUserId: rows.rowsOwnerUserId,
        shiftHeld
    });
    const table = useReactTable({
        data: rows.orderedRows,
        columns,
        state: {
            columnOrder: tableState.columnOrder,
            columnSizing: tableState.columnSizing,
            columnVisibility: tableState.columnVisibility,
            sorting: tableState.sorting,
            pagination: tableState.pagination
        },
        onSortingChange: tableState.setSorting,
        onPaginationChange: tableState.setPagination,
        onColumnVisibilityChange: tableState.setColumnVisibility,
        onColumnOrderChange: tableState.setColumnOrder,
        onColumnSizingChange: tableState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        meta: {
            columnOrderLocked: tableState.columnOrderLocked,
            setColumnOrderLocked: tableState.setColumnOrderLocked
        }
    });
    const isLoading = rows.loadStatus === 'running' && rows.rows.length === 0;
    const isError = rows.loadStatus === 'error' && rows.rows.length === 0;

    return {
        filters,
        isError,
        isLoading,
        rows,
        table,
        tableState
    };
}
