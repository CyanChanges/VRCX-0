import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shadcn/card';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/ui/shadcn/dropdown-menu';
import { Input } from '@/ui/shadcn/input';
import { Switch } from '@/ui/shadcn/switch';

import { Field } from '../SettingsField';
import { SettingsTabContent } from '../SettingsViewParts';

export function SettingsSocialTab({ social }: any) {
    const {
        prefs,
        selectedFavoriteFriendGroupLabel,
        favoriteFriendGroupOptions,
        remoteFavoriteFriendGroupOptions,
        localFavoriteFriendGroupOptions,
        localFavoriteFriendsGroups,
        onRecentActionCooldownEnabledChange,
        onRecentActionCooldownMinutesChange,
        onRecentActionCooldownMinutesBlur,
        onToggleLocalFavoriteFriendsGroup
    } = social;
    const { t } = useTranslation();
    const favoriteGroupLabel =
        selectedFavoriteFriendGroupLabel ||
        t('view.settings.general.favorites.group_placeholder');

    return (
        <SettingsTabContent value="social">
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('view.settings.social.interaction.header')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t(
                            'view.settings.appearance.user_dialog.recent_action_cooldown'
                        )}
                        description={t(
                            'view.settings.appearance.user_dialog.recent_action_cooldown_description'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={prefs.recentActionCooldownEnabled}
                                onCheckedChange={
                                    onRecentActionCooldownEnabledChange
                                }
                            />
                            {prefs.recentActionCooldownEnabled ? (
                                <Input
                                    type="number"
                                    min={1}
                                    max={1440}
                                    className="w-28"
                                    value={prefs.recentActionCooldownMinutes}
                                    onChange={(event: any) =>
                                        onRecentActionCooldownMinutesChange(
                                            event.target.value
                                        )
                                    }
                                    onBlur={(event: any) =>
                                        onRecentActionCooldownMinutesBlur(
                                            event.target.value
                                        )
                                    }
                                />
                            ) : null}
                        </div>
                    </Field>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('view.settings.social.favorites.header')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <Field
                        label={t('view.settings.general.favorites.header')}
                        description={t(
                            'view.settings.general.favorites.header_tooltip'
                        )}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-56 justify-between"
                                >
                                    <span className="truncate">
                                        {favoriteGroupLabel}
                                    </span>
                                    <ChevronDownIcon
                                        data-icon="inline-end"
                                        className="opacity-50"
                                    />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                {favoriteFriendGroupOptions.length ? (
                                    <>
                                        <DropdownMenuGroup>
                                            {remoteFavoriteFriendGroupOptions.map(
                                                (group: any) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={group.value}
                                                        checked={localFavoriteFriendsGroups.includes(
                                                            group.value
                                                        )}
                                                        onSelect={(event: any) =>
                                                            event.preventDefault()
                                                        }
                                                        onCheckedChange={(
                                                            checked: any
                                                        ) =>
                                                            onToggleLocalFavoriteFriendsGroup(
                                                                group.value,
                                                                checked
                                                            )
                                                        }
                                                    >
                                                        {group.label}
                                                    </DropdownMenuCheckboxItem>
                                                )
                                            )}
                                        </DropdownMenuGroup>
                                        {remoteFavoriteFriendGroupOptions.length &&
                                        localFavoriteFriendGroupOptions.length ? (
                                            <DropdownMenuSeparator />
                                        ) : null}
                                        <DropdownMenuGroup>
                                            {localFavoriteFriendGroupOptions.map(
                                                (group: any) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={group.value}
                                                        checked={localFavoriteFriendsGroups.includes(
                                                            group.value
                                                        )}
                                                        onSelect={(event: any) =>
                                                            event.preventDefault()
                                                        }
                                                        onCheckedChange={(
                                                            checked: any
                                                        ) =>
                                                            onToggleLocalFavoriteFriendsGroup(
                                                                group.value,
                                                                checked
                                                            )
                                                        }
                                                    >
                                                        {group.label}
                                                    </DropdownMenuCheckboxItem>
                                                )
                                            )}
                                        </DropdownMenuGroup>
                                    </>
                                ) : (
                                    <div className="text-muted-foreground px-2 py-1.5 text-sm">
                                        {t(
                                            'view.settings.general.favorites.group_placeholder'
                                        )}
                                    </div>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </Field>
                </CardContent>
            </Card>
        </SettingsTabContent>
    );
}
