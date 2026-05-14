import { PreviousInstancesTableDialog } from '@/components/dialogs/PreviousInstancesTableDialog';
import { PageBody, PageScaffold } from '@/components/layout/PageScaffold';

import { FeedTableShell } from './components/FeedTableShell';
import { FeedToolbar } from './components/FeedToolbar';
import { useFeedPageController } from './useFeedPageController';

type FeedPageProps = {
    embedded?: boolean;
};

export function FeedPage({ embedded = false }: FeedPageProps = {}) {
    const {
        columns,
        filters,
        friendActions,
        isFavoritesLoaded,
        loadStatus,
        previousInstancesDialog,
        resolvePageSize,
        rows,
        table,
        tableModel
    } = useFeedPageController();

    return (
        <PageScaffold embedded={embedded} className={embedded ? '' : 'feed'}>
            <FeedToolbar
                filterModel={{
                    activeFilterCount: filters.activeFilterCount,
                    activeFilters: filters.activeFilters,
                    dateDraftFrom: filters.dateDraftFrom,
                    dateDraftRange: filters.dateDraftRange,
                    dateDraftTo: filters.dateDraftTo,
                    dateFilterOpen: filters.dateFilterOpen,
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                    favoritesOnly: filters.favoritesOnly,
                    feedFilterTypes: filters.feedFilterTypes,
                    searchDraft: filters.searchDraft,
                    todayDate: filters.todayDate
                }}
                filterCommands={{
                    onApplyDateFilter: filters.applyDateFilter,
                    onClearDateFilter: filters.clearDateFilter,
                    onClearFeedFilters: () => filters.setFeedFilters([]),
                    onClearSearch: filters.clearSearch,
                    onDateFilterOpenChange: filters.setDateFilterOpen,
                    onDateRangeSelect: filters.onDateRangeSelect,
                    onSearchBlur: () => filters.commitSearch(),
                    onSearchDraftChange: filters.setSearchDraft,
                    onSearchEnter: filters.commitSearch,
                    onToggleFavoritesOnly: () =>
                        filters.setFavoritesOnly((current) => !current),
                    onToggleFeedFilter: filters.toggleFeedFilter
                }}
                table={table}
            />
            <PageBody>
                <FeedTableShell
                    columns={columns}
                    favoritesOnly={filters.favoritesOnly}
                    isFavoritesLoaded={isFavoritesLoaded}
                    loadStatus={loadStatus}
                    loadingPreviousInstancesKey={
                        previousInstancesDialog.loadingKey
                    }
                    onNewInstance={friendActions.openFeedNewInstance}
                    onOpenPreviousInstances={
                        previousInstancesDialog.openPreviousInstancesForLocation
                    }
                    onPaginationChange={tableModel.setPagination}
                    pageSizes={tableModel.pageSizes}
                    pagination={tableModel.pagination}
                    resolvePageSize={resolvePageSize}
                    rows={rows}
                    table={table}
                />
            </PageBody>
            <PreviousInstancesTableDialog
                open={previousInstancesDialog.open}
                onOpenChange={previousInstancesDialog.setOpen}
                title={previousInstancesDialog.title}
                instances={previousInstancesDialog.rows}
                onRowsChange={previousInstancesDialog.setRows}
            />
        </PageScaffold>
    );
}
