import { useTranslation } from 'react-i18next';

import { openShortcutFolder } from '@/services/shellIntegrationService';

import { SettingsAdvancedTab } from './settings-tabs/SettingsAdvancedTab';

export function SettingsAdvancedSection({ advanced }: any) {
    const { t } = useTranslation();
    const {
        prefs,
        cacheStats,
        cacheStatsVisible,
        avatarAutoCleanupOptions,
        sqliteTableSizes,
        sqliteTableSizeRows,
        onlineVisitCount,
        configTreeData,
        tauriAppSnapshot,
        saveBoolPreference,
        saveAppLauncherField,
        clearVrcxCache,
        promptAutoClearVrcxCacheFrequency,
        refreshCacheSize,
        handleGameLogDisabledChange,
        saveStringPreference,
        setPurgeDialogOpen,
        refreshSqliteTableSizes,
        refreshOnlineVisits,
        refreshConfigTreeData,
        refreshRuntimeAppSnapshot,
        setConfigTreeData,
        migrateLegacyVrcxData
    } = advanced;

    const advancedTab = {
        prefs,
        cacheStats,
        cacheStatsVisible,
        avatarAutoCleanupOptions,
        sqliteTableSizes,
        sqliteTableSizeRows,
        onlineVisitCount,
        configTreeData,
        tauriAppSnapshot,
        gameLogDisabledLabel: t(
            'view.settings.advanced.advanced.cache_debug.disable_gamelog'
        ),
        onRelaunchVRChatAfterCrashChange: (checked: any) => {
            saveBoolPreference(
                'relaunchVRChatAfterCrash',
                'VRCX_relaunchVRChatAfterCrash',
                checked
            );
        },
        onVrcQuitFixChange: (checked: any) => {
            saveBoolPreference('vrcQuitFix', 'vrcQuitFix', checked);
        },
        onAutoSweepVRChatCacheChange: (checked: any) => {
            saveBoolPreference(
                'autoSweepVRChatCache',
                'VRCX_autoSweepVRChatCache',
                checked
            );
        },
        onUdonExceptionLoggingChange: (checked: any) => {
            saveBoolPreference(
                'udonExceptionLogging',
                'VRCX_udonExceptionLogging',
                checked
            );
        },
        onLogResourceLoadChange: (checked: any) => {
            saveBoolPreference('logResourceLoad', 'logResourceLoad', checked);
        },
        onOpenShortcutFolder: () => {
            openShortcutFolder();
        },
        onEnableAppLauncherChange: (checked: any) => {
            saveAppLauncherField('enableAppLauncher', checked);
        },
        onEnableAppLauncherAutoCloseChange: (checked: any) => {
            saveAppLauncherField('enableAppLauncherAutoClose', checked);
        },
        onEnableAppLauncherRunProcessOnceChange: (checked: any) => {
            saveAppLauncherField('enableAppLauncherRunProcessOnce', checked);
        },
        onShowConfirmationOnSwitchAvatarChange: (checked: any) => {
            saveBoolPreference(
                'showConfirmationOnSwitchAvatar',
                'showConfirmationOnSwitchAvatar',
                checked
            );
        },
        onClearVrcxCache: () => {
            clearVrcxCache();
        },
        onPromptAutoClearVrcxCacheFrequency: () => {
            promptAutoClearVrcxCacheFrequency();
        },
        onRefreshCacheSize: () => {
            refreshCacheSize();
        },
        onGameLogDisabledChange: (checked: any) => {
            handleGameLogDisabledChange(checked);
        },
        onAvatarAutoCleanupChange: (value: any) => {
            saveStringPreference(
                'avatarAutoCleanup',
                'avatarAutoCleanup',
                value
            );
        },
        onOpenPurgeDialog: () => setPurgeDialogOpen(true),
        onMigrateLegacyVrcxData: () => {
            migrateLegacyVrcxData();
        },
        onRefreshSqliteTableSizes: () => {
            refreshSqliteTableSizes();
        },
        onRefreshOnlineVisits: () => {
            refreshOnlineVisits();
        },
        onRefreshConfigTreeData: () => {
            refreshConfigTreeData();
        },
        onRefreshRuntimeAppSnapshot: () => {
            refreshRuntimeAppSnapshot();
        },
        onClearConfigTreeData: () => setConfigTreeData({})
    };

    return <SettingsAdvancedTab advanced={advancedTab} />;
}
