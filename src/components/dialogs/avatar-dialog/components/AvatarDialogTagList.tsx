import { Badge } from '@/ui/shadcn/badge';

export function AvatarDialogTagList({ tags, trimPrefix = '' }: any) {
    if (!tags.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {tags.map((tag: any) => (
                <Badge key={tag} variant="outline">
                    {trimPrefix ? tag.replace(trimPrefix, '') : tag}
                </Badge>
            ))}
        </div>
    );
}
