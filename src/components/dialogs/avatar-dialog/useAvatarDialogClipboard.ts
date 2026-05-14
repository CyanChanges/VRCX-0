import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { copyTextToClipboard } from '@/services/entityMediaService';

export function useAvatarDialogClipboard() {
    const { t } = useTranslation();

    return async function copyAvatarText(text: any, label: any) {
        await copyTextToClipboard(text);
        toast.success(
            t('dialog.avatar.dynamic.value_copied', {
                value: label
            })
        );
    };
}
