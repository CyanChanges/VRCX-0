import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    UPDATE_AVAILABLE_TOAST_ID,
    installLatestAvailableUpdate
} from '@/services/updateInstallService';
import { useRuntimeStore } from '@/state/runtimeStore';

function getLatestUpdaterDisplayVersion(release: any) {
    return (
        String(
            release?.latestVersion ||
                release?.displayVersion ||
                release?.canonicalVersion ||
                release?.tagName ||
                ''
        ).trim() || '-'
    );
}

export function UpdateAvailableToastHost() {
    const { t } = useTranslation();
    const hasAvailableUpdate = useRuntimeStore((state: any) =>
        Boolean(state.updateLoop.hasAvailableUpdate)
    );
    const latestUpdaterRelease = useRuntimeStore(
        (state: any) => state.updateLoop.latestUpdaterRelease
    );
    const lastUpdaterCheckDetail = useRuntimeStore(
        (state: any) => state.updateLoop.lastUpdaterCheckDetail
    );

    useEffect(() => {
        if (!hasAvailableUpdate || !latestUpdaterRelease) {
            toast.dismiss(UPDATE_AVAILABLE_TOAST_ID);
            return undefined;
        }

        toast.info(
            t('dialog.vrcx_updater.ready_for_update', {
                value: getLatestUpdaterDisplayVersion(latestUpdaterRelease)
            }),
            {
                id: UPDATE_AVAILABLE_TOAST_ID,
                description:
                    String(lastUpdaterCheckDetail || '').trim() ||
                    t(
                        'service.background_maintenance.label.vrcx_update_available'
                    ),
                duration: Infinity,
                position: 'bottom-right',
                closeButton: true,
                dismissible: true,
                action: {
                    label: t('nav_menu.update'),
                    onClick: () => {
                        void installLatestAvailableUpdate({
                            toastId: UPDATE_AVAILABLE_TOAST_ID
                        });
                    }
                }
            }
        );

        return undefined;
    }, [hasAvailableUpdate, lastUpdaterCheckDetail, latestUpdaterRelease, t]);

    return null;
}
