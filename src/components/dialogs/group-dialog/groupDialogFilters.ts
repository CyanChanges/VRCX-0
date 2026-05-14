export function getGroupDialogTabs(t: any) {
    return [
        { value: 'overview', label: t('dialog.group.overview.header') },
        { value: 'events', label: t('dialog.group.events.header') },
        { value: 'posts', label: t('dialog.group.posts.header') },
        { value: 'members', label: t('dialog.group.members.header') },
        { value: 'photos', label: t('dialog.group.gallery.header') },
        {
            value: 'instance-history',
            label: t('dialog.previous_instances.header')
        },
        { value: 'json', label: t('dialog.group.json.header') }
    ];
}

export function filterGroupPosts(posts: any, queryValue: any) {
    const query = queryValue.trim().toLowerCase();
    if (!query) {
        return posts;
    }
    return posts.filter((post: any) =>
        [post?.title, post?.text, post?.authorId].some((value: any) =>
            String(value || '')
                .toLowerCase()
                .includes(query)
        )
    );
}

export function filterGroupMembers(members: any, queryValue: any) {
    const query = queryValue.trim().toLowerCase();
    if (!query) {
        return members;
    }
    return members.filter((member: any) =>
        [
            member?.user?.displayName,
            member?.displayName,
            member?.userId,
            member?.user?.id
        ].some((value: any) =>
            String(value || '')
                .toLowerCase()
                .includes(query)
        )
    );
}
