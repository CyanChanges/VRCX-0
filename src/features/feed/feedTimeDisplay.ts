import type { TFunction } from 'i18next';

import { formatDateFilter } from '@/lib/dateTime';
import type { FeedTimeDisplayModePreference } from '@/state/preferencesStore';

function parseTimestampMs(value: unknown) {
    if (!value) {
        return null;
    }

    const timestampMs = new Date(value as any).getTime();
    return Number.isFinite(timestampMs) ? timestampMs : null;
}

export function formatFeedRelativeTime(
    value: unknown,
    nowMs: number,
    t: TFunction
) {
    const timestampMs = parseTimestampMs(value);
    if (timestampMs === null) {
        return '-';
    }

    const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
    if (seconds < 30) {
        return t('view.feed.time.just_now');
    }

    if (seconds < 60) {
        return t('view.feed.time.seconds_ago', { count: seconds });
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return t('view.feed.time.minutes_ago', { count: minutes });
    }

    return t('view.feed.time.hours_ago', {
        count: Math.floor(minutes / 60)
    });
}

export function formatFeedExactTime(
    value: unknown,
    format: 'short' | 'long' = 'short'
) {
    if (!value) {
        return '-';
    }

    return formatDateFilter(value, format);
}

export function resolveFeedColumnTimeDisplay({
    mode,
    nowMs,
    t,
    value
}: {
    mode: FeedTimeDisplayModePreference;
    nowMs: number;
    t: TFunction;
    value: unknown;
}) {
    if (mode === 'relative') {
        return {
            label: formatFeedRelativeTime(value, nowMs, t),
            title: formatFeedExactTime(value, 'long')
        };
    }

    return {
        label: formatFeedExactTime(value, 'short'),
        title: formatFeedRelativeTime(value, nowMs, t)
    };
}
