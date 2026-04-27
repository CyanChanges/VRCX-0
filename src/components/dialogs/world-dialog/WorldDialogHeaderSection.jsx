import {
    CopyIcon,
    DownloadIcon,
    EyeIcon,
    ExternalLinkIcon,
    FlagIcon,
    GlobeIcon,
    HomeIcon,
    ImageIcon,
    LanguagesIcon,
    LineChartIcon,
    MessageSquareIcon,
    PencilIcon,
    RefreshCwIcon,
    Trash2Icon,
    UploadIcon
} from 'lucide-react';
import { isValidElement } from 'react';

import { FavoriteActionMenu } from '@/components/favorites/FavoriteActionMenu.jsx';
import { userFacingErrorMessage } from '@/lib/errorDisplay.js';
import { cn } from '@/lib/utils.js';
import { Badge } from '@/ui/shadcn/badge';
import { Button } from '@/ui/shadcn/button';
import { Separator } from '@/ui/shadcn/separator';
import { Spinner } from '@/ui/shadcn/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/ui/shadcn/tooltip';

import {
    EntityActionDropdown,
    EntityActionItem,
    EntityActionSeparator
} from '../EntityDialogScaffold.jsx';
import { PlatformBadge } from './WorldDialogViewParts.jsx';
import { useWorldDescriptionTranslation } from './useWorldDescriptionTranslation.js';

function overviewValue(value) {
    return value || value === 0 ? String(value) : '—';
}

function WorldOverviewMetric({ label, value }) {
    const displayValue = overviewValue(value);
    if (displayValue === '—') {
        return null;
    }

    return (
        <div className="flex min-w-0 items-baseline gap-1">
            <span className="text-muted-foreground truncate">
                {label}
            </span>
            <span className="truncate font-medium tabular-nums text-foreground">
                {displayValue}
            </span>
        </div>
    );
}

function WorldOverviewActions({ handlers, state, t }) {
    const {
        actionStatus,
        canManageWorld,
        canUpdateHome,
        hasPersistData,
        isHomeWorld,
        isPublished,
        packageUrl,
        previousInstances,
        world,
        worldUrl
    } = state;
    const {
        onChangeAllowedDomains,
        onChangeCapacity,
        onChangeDescription,
        onChangeImage,
        onChangePreview,
        onChangeRecommendedCapacity,
        onChangeTags,
        onChangeTab,
        onCopyWorldId,
        onCopyWorldUrl,
        onDelete,
        onDeleteCache,
        onDeletePersistentData,
        onHome,
        onNewInstance,
        onNewInstanceSelfInvite,
        onOpenCache,
        onOpenPackage,
        onOpenWorldPage,
        onPublication,
        onRefresh,
        onRename
    } = handlers;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button
                type="button"
                size="sm"
                className="min-w-0 flex-1"
                disabled={actionStatus === 'new-instance'}
                onClick={onNewInstance}
            >
                <FlagIcon data-icon="inline-start" />
                <span className="truncate">
                    {t('dialog.world.actions.new_instance')}
                </span>
            </Button>
            {world.$isCached ? (
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={t('dialog.world.actions.delete_cache_tooltip')}
                    disabled={actionStatus === 'cache'}
                    onClick={onDeleteCache}
                >
                    <Trash2Icon data-icon="inline-start" />
                </Button>
            ) : null}
            <FavoriteActionMenu
                kind="world"
                entityId={world.id}
                entity={world}
                iconOnly
            />
            <EntityActionDropdown busy={actionStatus !== 'idle'}>
                <EntityActionItem
                    icon={RefreshCwIcon}
                    disabled={actionStatus === 'refresh'}
                    onSelect={onRefresh}
                >
                    {t('common.actions.refresh')}
                </EntityActionItem>
                {worldUrl ? (
                    <>
                        <EntityActionItem
                            icon={CopyIcon}
                            onSelect={() => void onCopyWorldUrl()}
                        >
                            {t('dialog.world.actions.copy_url')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={ExternalLinkIcon}
                            onSelect={onOpenWorldPage}
                        >
                            {t('common.actions.open_link')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={CopyIcon}
                            onSelect={() => void onCopyWorldId()}
                        >
                            {t('dialog.world.info.copy_id')}
                        </EntityActionItem>
                    </>
                ) : null}
                <EntityActionSeparator />
                <EntityActionItem
                    icon={FlagIcon}
                    disabled={actionStatus === 'new-instance'}
                    onSelect={onNewInstance}
                >
                    {t('dialog.world.actions.new_instance')}
                </EntityActionItem>
                <EntityActionItem
                    icon={MessageSquareIcon}
                    disabled={actionStatus === 'new-instance'}
                    onSelect={onNewInstanceSelfInvite}
                >
                    {t('dialog.world.actions.new_instance_and_self_invite')}
                </EntityActionItem>
                <EntityActionItem
                    icon={HomeIcon}
                    disabled={!canUpdateHome || actionStatus === 'home'}
                    onSelect={onHome}
                >
                    {t(
                        isHomeWorld
                            ? 'dialog.world.actions.reset_home'
                            : 'dialog.world.actions.make_home'
                    )}
                </EntityActionItem>
                <EntityActionItem
                    icon={LineChartIcon}
                    disabled={!previousInstances.length}
                    onSelect={() => onChangeTab('visit-history')}
                >
                    {t('dialog.world.actions.show_previous_instances')}
                </EntityActionItem>
                <EntityActionItem
                    icon={UploadIcon}
                    disabled={!hasPersistData || actionStatus === 'persistent-data'}
                    onSelect={onDeletePersistentData}
                >
                    {t('dialog.world.actions.delete_persistent_data')}
                </EntityActionItem>
                {world.$isCached ? (
                    <EntityActionItem icon={DownloadIcon} onSelect={onOpenCache}>
                        {t('dialog.world.tags.cache')}
                    </EntityActionItem>
                ) : null}
                <EntityActionSeparator />
                {canManageWorld ? (
                    <>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onRename}
                        >
                            {t('dialog.world.actions.rename')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangeDescription}
                        >
                            {t('dialog.world.actions.change_description')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangeCapacity}
                        >
                            {t('dialog.world.actions.change_capacity')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangeRecommendedCapacity}
                        >
                            {t('dialog.world.actions.change_recommended_capacity')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangePreview}
                        >
                            {t('prompt.change_world_preview.header')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangeTags}
                        >
                            {t('dialog.world.generated.change_tags')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={PencilIcon}
                            disabled={actionStatus === 'save-world'}
                            onSelect={onChangeAllowedDomains}
                        >
                            {t('dialog.world.generated.change_allowed_domains')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={ImageIcon}
                            disabled={actionStatus === 'image-upload'}
                            onSelect={onChangeImage}
                        >
                            {t('dialog.world.actions.change_image')}
                        </EntityActionItem>
                        {packageUrl ? (
                            <EntityActionItem
                                icon={DownloadIcon}
                                onSelect={onOpenPackage}
                            >
                                {t('dialog.world.actions.download_package')}
                            </EntityActionItem>
                        ) : null}
                        <EntityActionSeparator />
                        <EntityActionItem
                            icon={EyeIcon}
                            disabled={actionStatus === 'publish-world'}
                            onSelect={onPublication}
                        >
                            {isPublished
                                ? t('dialog.world.actions.unpublish')
                                : t('dialog.world.actions.publish_to_labs')}
                        </EntityActionItem>
                        <EntityActionItem
                            icon={Trash2Icon}
                            destructive
                            disabled={actionStatus === 'delete'}
                            onSelect={onDelete}
                        >
                            {t('common.actions.delete')}
                        </EntityActionItem>
                    </>
                ) : null}
            </EntityActionDropdown>
        </div>
    );
}

export function WorldDialogOverviewSection({ handlers, state, t }) {
    const {
        detail,
        favoriteRate,
        hasPersistData,
        imageUrl,
        isHomeWorld,
        platformRows,
        visibleTags,
        world
    } = state;
    const { onCopyWorldName, onOpenAuthor, onOpenImage, onOpenCache } = handlers;
    const {
        descriptionTranslationLoading,
        translatedDescriptionActive,
        toggleDescriptionTranslation,
        visibleDescription
    } = useWorldDescriptionTranslation({ world, t });
    const descriptionActionLabel = translatedDescriptionActive
        ? t('dialog.world.info.show_original_description', {
              defaultValue: 'Show Original'
          })
        : t('dialog.world.info.translate_description', {
              defaultValue: 'Translate Description'
          });
    const releaseLabel = world.isLabs
        ? t('dialog.world.tags.labs')
        : world.releaseStatus === 'public'
          ? t('dialog.world.tags.public')
          : world.releaseStatus === 'private'
            ? t('dialog.world.tags.private')
          : world.releaseStatus || 'Unknown';
    const favoritesText = world.favorites
        ? `${world.favorites}${favoriteRate ? ` (${favoriteRate}%)` : ''}`
        : '';

    return (
        <aside className="flex min-h-0 min-w-0 flex-col gap-3">
            <Button
                type="button"
                variant="ghost"
                disabled={!imageUrl || !onOpenImage}
                onClick={onOpenImage}
                className={cn(
                    'bg-muted aspect-[4/3] h-auto w-full overflow-hidden rounded-md border p-0 disabled:pointer-events-none',
                    imageUrl && onOpenImage ? 'cursor-pointer' : 'cursor-default'
                )}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={world.name || world.id || 'World'}
                        className="size-full object-cover"
                    />
                ) : (
                    <span className="flex size-full items-center justify-center">
                        <GlobeIcon className="text-muted-foreground size-10" />
                    </span>
                )}
            </Button>

            <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-start gap-2 overflow-hidden">
                    {isHomeWorld ? (
                        <HomeIcon className="mt-0.5 size-5 shrink-0" />
                    ) : null}
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={!world.name}
                        className="hover:text-primary h-auto min-w-0 flex-1 justify-start overflow-hidden p-0 text-left text-lg leading-tight font-semibold whitespace-normal disabled:pointer-events-none disabled:opacity-100"
                        onClick={world.name ? onCopyWorldName : undefined}
                    >
                        <span className="line-clamp-2 min-w-0 break-all">
                            {world.name || 'World'}
                        </span>
                    </Button>
                </div>
                {world.authorName ? (
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={!world.authorId}
                        className="text-muted-foreground hover:text-primary h-auto max-w-full min-w-0 justify-start overflow-hidden p-0 text-left font-mono text-sm disabled:pointer-events-none disabled:opacity-100"
                        onClick={world.authorId ? onOpenAuthor : undefined}
                    >
                        <span className="truncate">{world.authorName}</span>
                    </Button>
                ) : null}
            </div>

            <WorldOverviewActions handlers={handlers} state={state} t={t} />

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <WorldOverviewMetric
                    label={t('dialog.world.info.players')}
                    value={world.occupants}
                />
                <WorldOverviewMetric
                    label={t('dialog.world.info.visits')}
                    value={world.visits}
                />
                <WorldOverviewMetric
                    label={t('dialog.world.info.favorites')}
                    value={favoritesText}
                />
                <WorldOverviewMetric
                    label={t('dialog.world.info.heat')}
                    value={world.heat}
                />
                <WorldOverviewMetric
                    label={t('dialog.world.info.popularity')}
                    value={world.popularity}
                />
            </div>

            <div className="flex flex-wrap gap-1.5">
                <Badge
                    variant={world.releaseStatus === 'public' ? 'default' : 'outline'}
                    className="max-w-full"
                >
                    <span className="truncate">{releaseLabel}</span>
                </Badge>
                {world.$isCached ? (
                    <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="rounded-full"
                        onClick={onOpenCache}
                    >
                        {world.$cacheSize
                            ? `${world.$cacheSize} ${t('dialog.world.tags.cache')}`
                            : t('dialog.world.tags.cache')}
                    </Button>
                ) : null}
                {hasPersistData ? (
                    <Badge variant="outline">
                        {t('dialog.world.info.persistent_data')}
                    </Badge>
                ) : null}
                {platformRows.map((platform) => (
                    <PlatformBadge key={platform} name={platform} />
                ))}
                {visibleTags.map((tag) => (
                    <Badge key={tag.key} variant="outline" className="max-w-full">
                        <span className="truncate">{tag.label}</span>
                    </Badge>
                ))}
            </div>

            {world.description ? (
                <>
                    <Separator />
                    <div className="relative min-w-0">
                        <div className="text-muted-foreground max-h-28 overflow-auto pr-8 text-sm whitespace-pre-wrap">
                            {visibleDescription}
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="ghost"
                                    className="absolute top-0 right-0"
                                    disabled={descriptionTranslationLoading}
                                    aria-label={descriptionActionLabel}
                                    onClick={() =>
                                        void toggleDescriptionTranslation()
                                    }
                                >
                                    {descriptionTranslationLoading ? (
                                        <Spinner data-icon="inline-start" />
                                    ) : (
                                        <LanguagesIcon data-icon="inline-start" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {descriptionActionLabel}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </>
            ) : null}

            {detail ? (
                <div className="text-muted-foreground text-xs">
                    {isValidElement(detail)
                        ? detail
                        : userFacingErrorMessage(
                              detail,
                              'The requested data could not be loaded.'
                          )}
                </div>
            ) : null}
        </aside>
    );
}
