import { cn } from '@/lib/utils';

import { resolveFeedStatusMeta as resolveStatusMeta } from '../feedRows';

function FeedStatusBadge({
    status,
    label
}: {
    label?: string;
    status: unknown;
}) {
    const meta = resolveStatusMeta(status);
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            {meta.className ? (
                <span
                    className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        meta.className
                    )}
                />
            ) : null}
            {label ? <span className="truncate">{label}</span> : null}
        </span>
    );
}

export { FeedStatusBadge };
