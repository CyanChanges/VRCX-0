import { useRef, useState } from 'react';

export function useFriendListUserLoadDialog() {
    const cancelUserLoadRef = useRef(false);
    const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);
    const [userLoadProgress, setUserLoadProgress] = useState<any>({
        current: 0,
        total: 0,
        open: false,
        cancelled: false
    });
    const userLoadPercent = userLoadProgress.total
        ? Math.min(
              100,
              Math.round(
                  (userLoadProgress.current / userLoadProgress.total) * 100
              )
          )
        : 0;

    function cancelFriendUserDetailsLoad() {
        cancelUserLoadRef.current = true;
        setUserLoadProgress((current: any) => ({
            ...current,
            open: false,
            cancelled: true
        }));
    }

    return {
        cancelUserLoadRef,
        isLoadingUserDetails,
        userLoadPercent,
        userLoadProgress,
        cancelFriendUserDetailsLoad,
        setIsLoadingUserDetails,
        setUserLoadProgress
    };
}
