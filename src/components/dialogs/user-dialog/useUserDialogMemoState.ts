import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import memoPersistenceRepository from '@/repositories/memoPersistenceRepository';
import vrchatToolsRepository from '@/repositories/vrchatToolsRepository';

import { normalizeUserId } from './userProfileFields';

export function useUserDialogMemoState({
    activeUserTargetRef,
    applyFriendPatch,
    currentEndpoint,
    friendsById,
    isCurrentUser,
    normalizedUserId,
    profile,
    prompt,
    setBaseProfile,
    t
}: any) {
    const [memo, setMemo] = useState('');
    const memoRevisionRef = useRef(0);

    useEffect(() => {
        let active = true;

        if (!normalizedUserId) {
            setMemo('');
            return () => {
                active = false;
            };
        }

        setMemo('');
        const revision = memoRevisionRef.current;
        memoPersistenceRepository
            .getUserMemo(normalizedUserId)
            .then((entry: any) => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo(entry?.memo || '');
                }
            })
            .catch(() => {
                if (active && memoRevisionRef.current === revision) {
                    setMemo('');
                }
            });

        return () => {
            active = false;
        };
    }, [normalizedUserId]);

    async function editMemo() {
        const targetProfile = profile;
        const targetUserId = normalizeUserId(targetProfile?.id);
        const targetEndpoint = currentEndpoint;
        const editingCurrentUser = isCurrentUser;
        if (!targetUserId) {
            return;
        }

        let nextNote = targetProfile.note || '';
        if (!editingCurrentUser) {
            const noteResult = await prompt({
                title: t('dialog.user.modal.edit_vrchat_note'),
                description: targetProfile.displayName || targetProfile.id,
                inputValue: nextNote,
                multiline: true,
                confirmText: t('dialog.user.modal.next'),
                cancelText: t('common.actions.cancel')
            });
            if (!noteResult.ok) {
                return;
            }
            nextNote = String(noteResult.value || '').slice(0, 256);
        }

        const result = await prompt({
            title: t('dialog.user.modal.edit_local_memo'),
            description: targetProfile.displayName || targetProfile.id,
            inputValue: memo,
            multiline: true,
            confirmText: t('common.actions.save'),
            cancelText: t('common.actions.cancel')
        });

        if (!result.ok) {
            return;
        }

        memoRevisionRef.current += 1;
        try {
            if (
                !editingCurrentUser &&
                nextNote !== (targetProfile.note || '')
            ) {
                await vrchatToolsRepository.saveUserNote(
                    {
                        targetUserId,
                        note: nextNote
                    },
                    { endpoint: targetEndpoint }
                );
            }
            const nextEntry = await memoPersistenceRepository.saveUserMemo({
                userId: targetUserId,
                memo: result.value
            });
            if (
                activeUserTargetRef.current.userId !== targetUserId ||
                activeUserTargetRef.current.endpoint !== targetEndpoint
            ) {
                return;
            }
            const nextMemo = String(nextEntry.memo || '');
            const rosterUserId = targetUserId;
            setMemo(nextMemo);
            setBaseProfile((currentProfile: any) =>
                normalizeUserId(currentProfile?.id) === targetUserId
                    ? {
                          ...currentProfile,
                          note: nextNote,
                          memo: nextMemo,
                          $nickName: nextMemo
                      }
                    : currentProfile
            );
            if (rosterUserId && friendsById[rosterUserId]) {
                applyFriendPatch({
                    userId: rosterUserId,
                    patch: {
                        note: nextNote,
                        memo: nextMemo,
                        $nickName: nextMemo
                    },
                    stateBucket:
                        friendsById[rosterUserId]?.stateBucket ||
                        friendsById[rosterUserId]?.state
                });
            }
            toast.success(
                nextMemo
                    ? t('dialog.user.toast.memo_saved')
                    : t('dialog.user.toast.memo_cleared')
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('dialog.user.toast.failed_to_save_memo')
            );
        }
    }

    return {
        editMemo,
        memo
    };
}
