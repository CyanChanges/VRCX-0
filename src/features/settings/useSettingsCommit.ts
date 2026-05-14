import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function useSettingsCommit() {
    const { t } = useTranslation();

    return async function commit(action: any, optimistic?: any) {
        const rollback = optimistic?.();
        try {
            await action();
            return true;
        } catch (error) {
            rollback?.();
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('view.settings.toast.failed_to_save_setting')
            );
            return false;
        }
    };
}
