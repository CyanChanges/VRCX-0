import {
    normalizeUserStatus,
    userStatusIndicatorClassName,
    userStatusSortRank
} from '@/shared/utils/userStatus';
import { languageMappings } from '@/shared/constants/language';

export function languageFlagLabel(languageKey: any) {
    const countryCode =
        languageMappings[String(languageKey || '').toLowerCase()];
    if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) {
        return (
            String(languageKey || '?')
                .slice(0, 3)
                .toUpperCase() || '?'
        );
    }

    return String.fromCodePoint(
        ...countryCode
            .toUpperCase()
            .split('')
            .map((letter: any) => 0x1f1e6 + letter.charCodeAt(0) - 65)
    );
}

export function languageTooltipLabel(entry: any) {
    const value = entry?.value || entry?.key || '';
    const key = entry?.key || '';
    if (value && key) {
        return `${value} (${key})`;
    }
    return value || key;
}

export function resolveFriendStatusMeta(friend: any) {
    const statusForIndicator = friend || {};
    const normalizedStatus = normalizeUserStatus(statusForIndicator);
    const indicatorClassName = userStatusIndicatorClassName(
        statusForIndicator,
        {
            showOffline: true,
            className: 'mr-1'
        }
    );
    return {
        badgeVariant: 'outline',
        indicatorClassName,
        label:
            friend?.statusDescription ||
            (normalizedStatus === 'state-active' ? 'Active' : normalizedStatus),
        showIndicator: Boolean(indicatorClassName),
        sortRank: userStatusSortRank(statusForIndicator || 'offline')
    };
}
