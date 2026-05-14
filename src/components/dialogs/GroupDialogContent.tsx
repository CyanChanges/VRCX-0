import { GroupDialogEmptyState } from './group-dialog/GroupDialogEmptyState';
import { GroupDialogTabbedView } from './group-dialog/GroupDialogTabbedView';
import { useGroupDialogState } from './group-dialog/useGroupDialogState';

export function GroupDialogContent({ groupId, seedData = null }: any) {
    const dialogState: any = useGroupDialogState({ groupId, seedData });

    if (dialogState.status !== 'ready') {
        return <GroupDialogEmptyState {...dialogState.emptyState} />;
    }

    const {
        actionStatus,
        actions,
        activeInstances,
        detail,
        group,
        labels,
        previousInstances,
        setPreviousInstances,
        viewState
    } = dialogState;

    return (
        <GroupDialogTabbedView
            groupResource={{
                group,
                detail,
                actionStatus,
                activeInstances,
                previousInstances
            }}
            groupView={viewState}
            groupControls={{
                onPreviousInstancesChange: setPreviousInstances,
                onRefresh: () => {
                    actions.refreshGroup();
                },
                onJoin: () => {
                    actions.joinGroup();
                },
                onLeave: () => {
                    actions.leaveGroup();
                },
                onCancelRequest: () => {
                    actions.cancelJoinRequest();
                },
                onRepresent: (enabled: any) => {
                    actions.updateGroupRepresentation(enabled);
                },
                onSubscribe: (enabled: any) => {
                    actions.updateGroupMemberProps(
                        { isSubscribedToAnnouncements: enabled },
                        enabled
                            ? labels.subscribedToAnnouncements
                            : labels.unsubscribedAnnouncements
                    );
                },
                onVisibility: (visibility: any) => {
                    actions.updateGroupMemberProps(
                        { visibility },
                        labels.visibilityUpdated
                    );
                },
                onBlock: (enabled: any) => {
                    actions.updateGroupBlock(enabled);
                }
            }}
        />
    );
}
