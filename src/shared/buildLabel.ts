export type VrcxBuildLabel = 'preview' | 'theme-devkit' | 'test' | string;

const PREVIEW_LABELS = new Set(['preview', 'test']);
const THEME_DEVKIT_LABEL = 'theme-devkit';

export function getVrcxBuildLabel(): VrcxBuildLabel {
    // oxlint-disable-next-line no-undef
    return typeof VRCX_0_BUILD_LABEL === 'string'
        ? VRCX_0_BUILD_LABEL.trim().toLowerCase()
        : '';
}

export function getVrcxBuildBadge(): string {
    // oxlint-disable-next-line no-undef
    return typeof VRCX_0_BUILD_BADGE === 'string'
        ? VRCX_0_BUILD_BADGE.trim()
        : '';
}

export function isLocalDevBuild(): boolean {
    return import.meta.env.DEV;
}

export function isPreviewBuildLabel(label = getVrcxBuildLabel()): boolean {
    return PREVIEW_LABELS.has(label);
}

export function isThemeDevKitBuildLabel(
    label = getVrcxBuildLabel()
): boolean {
    return label === THEME_DEVKIT_LABEL;
}

export function isDeveloperToolsBuild(): boolean {
    const label = getVrcxBuildLabel();
    return (
        isLocalDevBuild() ||
        isPreviewBuildLabel(label) ||
        isThemeDevKitBuildLabel(label)
    );
}

export function isThemeDeveloperBuild(): boolean {
    return isLocalDevBuild() || isThemeDevKitBuildLabel();
}

export function getBuildBadgeI18nKey(): string | null {
    const label = getVrcxBuildLabel();
    if (isThemeDevKitBuildLabel(label)) {
        return 'app_menu.theme_devkit_build_badge';
    }
    if (isPreviewBuildLabel(label)) {
        return 'app_menu.preview_build_badge';
    }
    return null;
}

export function getBuildBadgeLabel(t: (key: string) => string): string {
    const buildBadge = getVrcxBuildBadge();
    if (buildBadge) {
        return buildBadge;
    }

    const buildBadgeKey = getBuildBadgeI18nKey();
    return buildBadgeKey ? t(buildBadgeKey) : '';
}
