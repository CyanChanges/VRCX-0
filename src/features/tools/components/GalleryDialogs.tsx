import { useTranslation } from 'react-i18next';

import { ImageCropDialog } from '@/components/media/ImageCropDialog';

export function GalleryDialogs({
    cropRequest,
    onClearCropRequest,
    onConfirmCrop,
    onResetUploadAuthTarget
}: any) {
    const { t } = useTranslation();

    return (
        <>
            <ImageCropDialog
                open={Boolean(cropRequest)}
                file={cropRequest?.file || null}
                aspectRatio={cropRequest?.aspectRatio || 1}
                title={t('dialog.change_content_image.upload')}
                onOpenChange={(open: any) => {
                    if (!open) {
                        onClearCropRequest();
                        onResetUploadAuthTarget();
                    }
                }}
                onConfirm={onConfirmCrop}
            />
        </>
    );
}
