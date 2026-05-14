import { useModalStore } from '@/state/modalStore';

export function useAvatarDialogPreview() {
    return useModalStore((state: any) => state.openImagePreview);
}
