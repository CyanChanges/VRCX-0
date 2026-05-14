import {
    formatDateFilterWithPreferences,
    timeToTextWithLabels,
    type DateFilterFormat,
    type TimeUnitLabels
} from '@/shared/utils/dateTime';
import { useShellStore } from '@/state/shellStore';

export function formatDateFilter(dateStr: any, format: DateFilterFormat) {
    const { dateCulture, dateIsoFormat, dateHour12 } = useShellStore.getState();
    return formatDateFilterWithPreferences(dateStr, format, {
        dateCulture,
        dateIsoFormat,
        dateHour12
    });
}

export function timeToText(
    sec: unknown,
    isNeedSeconds: any = false,
    unitLabels: Partial<TimeUnitLabels> | undefined = undefined
) {
    return timeToTextWithLabels(
        sec,
        isNeedSeconds,
        unitLabels || useShellStore.getState().timeUnitLabels
    );
}
