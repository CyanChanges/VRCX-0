import { cn } from '@/lib/utils';
import { Kbd, KbdGroup } from '@/ui/shadcn/kbd';

const KEY_LABELS: any = {
    ArrowLeft: '\u2190',
    ArrowRight: '\u2192',
    ArrowUp: '\u2191',
    ArrowDown: '\u2193',
    Meta: '\u2318',
    Mod: 'Ctrl',
    Control: 'Ctrl',
    Escape: 'Esc'
};

const KEY_ARIA_LABELS: any = {
    ArrowLeft: 'Arrow Left',
    ArrowRight: 'Arrow Right',
    ArrowUp: 'Arrow Up',
    ArrowDown: 'Arrow Down',
    Meta: 'Command',
    Mod: 'Control',
    Control: 'Control',
    Escape: 'Escape'
};

function normalizeKeys(keys: any) {
    return Array.isArray(keys) ? keys : [keys];
}

export function KeyboardShortcut({
    keys,
    className = '',
    kbdClassName = '',
    ...props
}: any) {
    const normalizedKeys = normalizeKeys(keys).filter(Boolean);

    if (!normalizedKeys.length) {
        return null;
    }

    return (
        <KbdGroup
            aria-label={normalizedKeys
                .map((key: any) => KEY_ARIA_LABELS[key] || key)
                .join(' + ')}
            className={cn('shrink-0', className)}
            {...props}
        >
            {normalizedKeys.map((key: any) => (
                <Kbd key={key} className={kbdClassName}>
                    {KEY_LABELS[key] || key}
                </Kbd>
            ))}
        </KbdGroup>
    );
}
