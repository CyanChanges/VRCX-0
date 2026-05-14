import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useNotificationTypeLabel() {
    const { t } = useTranslation();

    return useCallback(
        (type: any) => {
            const fallback = type || 'unknown';
            const key = `view.notification.filters.${fallback}`;
            const label = t(key);
            return label && label !== key ? label : fallback;
        },
        [t]
    );
}
