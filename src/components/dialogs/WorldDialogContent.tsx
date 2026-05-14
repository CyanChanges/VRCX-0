import { WorldDialogContentController } from './WorldDialogContentController';

export function WorldDialogContent({
    worldId,
    seedData = null,
    initialAction = '',
    openNonce = 0,
    initialActionNonce = 0,
    initialNewInstanceDefaults = null
}: any) {
    return (
        <WorldDialogContentController
            worldId={worldId}
            seedData={seedData}
            initialAction={initialAction}
            openNonce={openNonce}
            initialActionNonce={initialActionNonce}
            initialNewInstanceDefaults={initialNewInstanceDefaults}
        />
    );
}
