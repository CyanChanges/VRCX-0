import { InviteMessageDialog } from '@/components/dialogs/InviteMessageDialog';
import { cn } from '@/lib/utils';

import { NotificationPageTable } from './components/NotificationPageTable';
import { NotificationPageToolbar } from './components/NotificationPageToolbar';
import { BoopReplyDialog } from './components/NotificationViewParts';
import { useVrcNotificationPageController } from './useVrcNotificationPageController';

export function VrcNotificationPage({ embedded = false }: any = {}) {
    const {
        actions,
        dialogs,
        filters,
        notificationTypeLabel,
        rowsState,
        runtime,
        table,
        tableState
    } = useVrcNotificationPageController();

    return (
        <>
            <div
                className={cn(
                    'flex h-full min-h-0 flex-col gap-3',
                    embedded
                        ? 'p-3'
                        : 'x-container x-container--auto-height p-4 pb-0'
                )}
            >
                <NotificationPageToolbar
                    activeTypes={filters.activeTypes}
                    searchQuery={filters.searchQuery}
                    notificationTypeLabel={notificationTypeLabel}
                    loadStatus={rowsState.loadStatus}
                    table={table}
                    onActiveTypesChange={filters.setActiveTypes}
                    onSearchQueryChange={filters.setSearchQuery}
                    onRefresh={rowsState.reload}
                    onClearFilters={filters.clearFilters}
                />
                <NotificationPageTable
                    table={table}
                    detail={rowsState.detail}
                    loadStatus={rowsState.loadStatus}
                    rowsCount={rowsState.rows.length}
                    pagination={tableState.pagination}
                    pageSizes={tableState.pageSizes}
                    onPageSizeChange={tableState.handlePageSizeChange}
                />
            </div>
            <InviteMessageDialog
                open={Boolean(dialogs.inviteResponseRequest)}
                onOpenChange={(open: any) => {
                    if (!open) {
                        dialogs.setInviteResponseRequest(null);
                    }
                }}
                currentUserId={runtime.currentUserId}
                endpoint={runtime.endpoint}
                messageType={
                    dialogs.inviteResponseRequest?.messageType || 'response'
                }
                mode="respond"
                targetLabel={
                    dialogs.inviteResponseRequest?.notification
                        ?.senderUsername ||
                    dialogs.inviteResponseRequest?.notification
                        ?.senderUserId ||
                    'this user'
                }
                allowEdit
                allowImageUpload={runtime.isLocalUserVrcPlusSupporter}
                onUse={(payload: any) =>
                    actions.sendInviteResponseSlot({
                        ...payload,
                        notification:
                            dialogs.inviteResponseRequest?.notification
                    })
                }
            />
            <BoopReplyDialog
                request={dialogs.boopReplyRequest}
                endpoint={runtime.endpoint}
                isLocalUserVrcPlusSupporter={
                    runtime.isLocalUserVrcPlusSupporter
                }
                onOpenChange={(open: any) => {
                    if (!open) {
                        dialogs.setBoopReplyRequest(null);
                    }
                }}
                onSend={actions.sendBoopReply}
            />
        </>
    );
}
