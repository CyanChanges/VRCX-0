import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const overlayOutputPath = path.join(
    repoRoot,
    'crates',
    'runtime-host',
    'src',
    'vr_overlay',
    'localization',
    'overlay_notifications.json'
);
const shellOutputPath = path.join(
    repoRoot,
    'src-tauri',
    'src',
    'localization',
    'shell_strings.json'
);

const overlayLocales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];
const shellLocales = [
    'cs',
    'en',
    'es',
    'fr',
    'hu',
    'ja',
    'ko',
    'pl',
    'pt',
    'ru',
    'th',
    'vi',
    'zh-CN',
    'zh-TW'
];
const keys = [
    'has_joined',
    'has_left',
    'is_joining',
    'gps',
    'online',
    'online_location',
    'offline',
    'status_update',
    'avatar_change',
    'friend',
    'unfriend',
    'display_name',
    'trust_level',
    'invite',
    'request_invite',
    'invite_response',
    'request_invite_response',
    'friend_request',
    'group_announcement_title',
    'group_informative_title',
    'group_invite_title',
    'group_join_request_title',
    'group_transfer_request_title',
    'group_queue_ready_title',
    'instance_closed_title',
    'blocked',
    'unblocked',
    'muted',
    'unmuted',
    'blocked_player_joined',
    'blocked_player_left',
    'muted_player_joined',
    'muted_player_left'
];
const pathKeys = [
    ['overlay.footer.players', ['overlay', 'footer', 'players']],
    [
        'overlay.footer.instance_duration',
        ['overlay', 'footer', 'instance_duration']
    ],
    ['overlay.access.public', ['dialog', 'new_instance', 'access_type_public']],
    ['overlay.access.invite', ['dialog', 'new_instance', 'access_type_invite']],
    [
        'overlay.access.invite_plus',
        ['dialog', 'new_instance', 'access_type_invite_plus']
    ],
    [
        'overlay.access.friends',
        ['dialog', 'new_instance', 'access_type_friend']
    ],
    [
        'overlay.access.friends_plus',
        ['dialog', 'new_instance', 'access_type_friend_plus']
    ],
    ['overlay.access.group', ['dialog', 'new_instance', 'access_type_group']],
    [
        'overlay.access.group_public',
        ['dialog', 'new_instance', 'group_access_type_public']
    ],
    [
        'overlay.access.group_plus',
        ['dialog', 'new_instance', 'group_access_type_plus']
    ],
    ['overlay.status.active', ['dialog', 'user', 'status', 'online']],
    ['overlay.status.join_me', ['dialog', 'user', 'status', 'join_me']],
    ['overlay.status.ask_me', ['dialog', 'user', 'status', 'ask_me']],
    ['overlay.status.busy', ['dialog', 'user', 'status', 'busy']]
];
const shellPathKeys = [
    ['nativeShell.tray.open', ['nativeShell', 'tray', 'open']],
    [
        'nativeShell.tray.backgroundMode',
        ['nativeShell', 'tray', 'backgroundMode']
    ],
    ['nativeShell.tray.rebuildUi', ['nativeShell', 'tray', 'rebuildUi']],
    ['nativeShell.tray.disableTheme', ['nativeShell', 'tray', 'disableTheme']],
    ['nativeShell.tray.exit', ['nativeShell', 'tray', 'exit']],
    [
        'nativeShell.notification.backgroundModeStarted.title',
        ['nativeShell', 'notification', 'backgroundModeStarted', 'title']
    ],
    [
        'nativeShell.notification.backgroundModeStarted.body',
        ['nativeShell', 'notification', 'backgroundModeStarted', 'body']
    ],
    [
        'nativeShell.notification.authFailure.title',
        ['nativeShell', 'notification', 'authFailure', 'title']
    ],
    [
        'nativeShell.notification.authFailure.body',
        ['nativeShell', 'notification', 'authFailure', 'body']
    ]
];
const shellMenuLabels = {
    en: {
        'nativeShell.menu.app.title': 'VRCX-0',
        'nativeShell.menu.app.about': 'About VRCX-0',
        'nativeShell.menu.app.settings': 'Settings...',
        'nativeShell.menu.app.checkUpdates': 'Check for Updates',
        'nativeShell.menu.app.restart': 'Restart VRCX-0',
        'nativeShell.menu.app.startBackgroundMode': 'Switch to Background Mode',
        'nativeShell.menu.app.logout': 'Log Out',
        'nativeShell.menu.app.quit': 'Quit VRCX-0',
        'nativeShell.menu.view.title': 'View',
        'nativeShell.menu.view.notificationCenter': 'Notification Center',
        'nativeShell.menu.view.quickSearch': 'Quick Search',
        'nativeShell.menu.view.directAccess': 'Direct Access',
        'nativeShell.menu.view.toggleNav': 'Toggle Navigation',
        'nativeShell.menu.view.toggleFriendsSidebar': 'Toggle Friends Sidebar',
        'nativeShell.menu.view.customNav': 'Customize Navigation',
        'nativeShell.menu.view.themes': 'Theme',
        'nativeShell.menu.view.zoomIn': 'Zoom In',
        'nativeShell.menu.view.zoomOut': 'Zoom Out',
        'nativeShell.menu.view.resetZoom': 'Reset Zoom',
        'nativeShell.menu.tools.title': 'Tools',
        'nativeShell.menu.tools.allTools': 'All Tools...',
        'nativeShell.menu.help.title': 'Help',
        'nativeShell.menu.help.changelog': 'Changelog',
        'nativeShell.menu.help.keyboardShortcuts': 'Keyboard Shortcuts',
        'nativeShell.menu.help.reportIssue': 'Report Issue',
        'nativeShell.menu.help.github': 'GitHub',
        'nativeShell.menu.help.discord': 'Join our Discord',
        'nativeShell.menu.help.qqGroup': 'QQ Group (Chinese community)',
        'nativeShell.menu.help.openDevtools': 'Open DevTools',
        'nativeShell.menu.help.supportVrcx': 'Support VRCX-0'
    },
    ja: {
        'nativeShell.menu.app.title': 'VRCX-0',
        'nativeShell.menu.app.about': 'VRCX-0 について',
        'nativeShell.menu.app.settings': '設定...',
        'nativeShell.menu.app.checkUpdates': 'アップデートを確認',
        'nativeShell.menu.app.restart': 'VRCX-0 を再起動',
        'nativeShell.menu.app.startBackgroundMode':
            'バックグラウンドモードへ切り替える',
        'nativeShell.menu.app.logout': 'ログアウト',
        'nativeShell.menu.app.quit': 'VRCX-0 を終了',
        'nativeShell.menu.view.title': '表示',
        'nativeShell.menu.view.notificationCenter': '通知センター',
        'nativeShell.menu.view.quickSearch': 'クイック検索',
        'nativeShell.menu.view.directAccess': 'ダイレクトアクセス',
        'nativeShell.menu.view.toggleNav': 'ナビを切り替え',
        'nativeShell.menu.view.toggleFriendsSidebar':
            'フレンドサイドバーを切り替え',
        'nativeShell.menu.view.customNav': 'ナビゲーションの編集',
        'nativeShell.menu.view.themes': 'テーマ',
        'nativeShell.menu.view.zoomIn': '拡大',
        'nativeShell.menu.view.zoomOut': '縮小',
        'nativeShell.menu.view.resetZoom': 'ズームをリセット',
        'nativeShell.menu.tools.title': 'ツール',
        'nativeShell.menu.tools.allTools': 'すべてのツール...',
        'nativeShell.menu.help.title': 'ヘルプ',
        'nativeShell.menu.help.changelog': '新機能 (更新履歴)',
        'nativeShell.menu.help.keyboardShortcuts': 'キーボードショートカット',
        'nativeShell.menu.help.reportIssue': '問題を報告',
        'nativeShell.menu.help.github': 'GitHub',
        'nativeShell.menu.help.discord': 'みんなと話そう (Discord)',
        'nativeShell.menu.help.qqGroup': 'QQグループ（中国語コミュニティ）',
        'nativeShell.menu.help.openDevtools': 'DevTools を開く',
        'nativeShell.menu.help.supportVrcx': 'VRCX-0 をサポート'
    },
    ko: {
        'nativeShell.menu.app.title': 'VRCX-0',
        'nativeShell.menu.app.about': 'VRCX-0 정보',
        'nativeShell.menu.app.settings': '설정...',
        'nativeShell.menu.app.checkUpdates': '업데이트 확인',
        'nativeShell.menu.app.restart': 'VRCX-0 다시 시작',
        'nativeShell.menu.app.startBackgroundMode': '배경 모드로 전환',
        'nativeShell.menu.app.logout': '로그아웃',
        'nativeShell.menu.app.quit': 'VRCX-0 종료',
        'nativeShell.menu.view.title': '보기',
        'nativeShell.menu.view.notificationCenter': '알림 센터',
        'nativeShell.menu.view.quickSearch': '빠른 검색',
        'nativeShell.menu.view.directAccess': '빠른 접근',
        'nativeShell.menu.view.toggleNav': '네비게이션 바 토글',
        'nativeShell.menu.view.toggleFriendsSidebar': '친구 사이드바 전환',
        'nativeShell.menu.view.customNav': '탐색 사용자 정의',
        'nativeShell.menu.view.themes': '테마',
        'nativeShell.menu.view.zoomIn': '확대',
        'nativeShell.menu.view.zoomOut': '축소',
        'nativeShell.menu.view.resetZoom': '줌 재설정',
        'nativeShell.menu.tools.title': '도구',
        'nativeShell.menu.tools.allTools': '모든 도구...',
        'nativeShell.menu.help.title': '도움말',
        'nativeShell.menu.help.changelog': '변경 내역',
        'nativeShell.menu.help.keyboardShortcuts': '키보드 단축키',
        'nativeShell.menu.help.reportIssue': '문제 보고',
        'nativeShell.menu.help.github': 'GitHub',
        'nativeShell.menu.help.discord': 'Discord에 가입하세요',
        'nativeShell.menu.help.qqGroup': 'QQ그룹 (중국 커뮤니티)',
        'nativeShell.menu.help.openDevtools': 'DevTools 열기',
        'nativeShell.menu.help.supportVrcx': 'VRCX-0 후원'
    },
    'zh-CN': {
        'nativeShell.menu.app.title': 'VRCX-0',
        'nativeShell.menu.app.about': '关于 VRCX-0',
        'nativeShell.menu.app.settings': '设置...',
        'nativeShell.menu.app.checkUpdates': '检查更新',
        'nativeShell.menu.app.restart': '重启 VRCX-0',
        'nativeShell.menu.app.startBackgroundMode': '切换到后台模式',
        'nativeShell.menu.app.logout': '退出登录',
        'nativeShell.menu.app.quit': '退出 VRCX-0',
        'nativeShell.menu.view.title': '视图',
        'nativeShell.menu.view.notificationCenter': '通知中心',
        'nativeShell.menu.view.quickSearch': '快速搜索',
        'nativeShell.menu.view.directAccess': '直接打开',
        'nativeShell.menu.view.toggleNav': '切换导航栏',
        'nativeShell.menu.view.toggleFriendsSidebar': '切换好友侧栏',
        'nativeShell.menu.view.customNav': '自定义导航栏',
        'nativeShell.menu.view.themes': '主题',
        'nativeShell.menu.view.zoomIn': '放大',
        'nativeShell.menu.view.zoomOut': '缩小',
        'nativeShell.menu.view.resetZoom': '重置缩放',
        'nativeShell.menu.tools.title': '工具',
        'nativeShell.menu.tools.allTools': '所有工具...',
        'nativeShell.menu.help.title': '帮助',
        'nativeShell.menu.help.changelog': '更新日志',
        'nativeShell.menu.help.keyboardShortcuts': '键盘快捷键',
        'nativeShell.menu.help.reportIssue': '反馈问题',
        'nativeShell.menu.help.github': '在 GitHub 上查看',
        'nativeShell.menu.help.discord': '加入 Discord',
        'nativeShell.menu.help.qqGroup': 'QQ群',
        'nativeShell.menu.help.openDevtools': '打开 DevTools',
        'nativeShell.menu.help.supportVrcx': '支持 VRCX-0'
    },
    'zh-TW': {
        'nativeShell.menu.app.title': 'VRCX-0',
        'nativeShell.menu.app.about': '關於 VRCX-0',
        'nativeShell.menu.app.settings': '設定...',
        'nativeShell.menu.app.checkUpdates': '檢查更新',
        'nativeShell.menu.app.restart': '重新啟動 VRCX-0',
        'nativeShell.menu.app.startBackgroundMode': '切換到背景模式',
        'nativeShell.menu.app.logout': '登出',
        'nativeShell.menu.app.quit': '退出 VRCX-0',
        'nativeShell.menu.view.title': '檢視',
        'nativeShell.menu.view.notificationCenter': '通知中心',
        'nativeShell.menu.view.quickSearch': '快速搜尋',
        'nativeShell.menu.view.directAccess': '直接存取',
        'nativeShell.menu.view.toggleNav': '切換導覽列',
        'nativeShell.menu.view.toggleFriendsSidebar': '切換好友側欄',
        'nativeShell.menu.view.customNav': '自訂導覽',
        'nativeShell.menu.view.themes': '主題',
        'nativeShell.menu.view.zoomIn': '放大',
        'nativeShell.menu.view.zoomOut': '縮小',
        'nativeShell.menu.view.resetZoom': '重設縮放',
        'nativeShell.menu.tools.title': '工具',
        'nativeShell.menu.tools.allTools': '所有工具...',
        'nativeShell.menu.help.title': '說明',
        'nativeShell.menu.help.changelog': '最新更新',
        'nativeShell.menu.help.keyboardShortcuts': '鍵盤快捷鍵',
        'nativeShell.menu.help.reportIssue': '回報問題',
        'nativeShell.menu.help.github': '在 GitHub 上查看',
        'nativeShell.menu.help.discord': '加入我們的 Discord',
        'nativeShell.menu.help.qqGroup': 'QQ 群',
        'nativeShell.menu.help.openDevtools': '開啟 DevTools',
        'nativeShell.menu.help.supportVrcx': '支持 VRCX-0'
    }
};

const overlayCatalog = createCatalog();

for (const locale of overlayLocales) {
    const inputPath = path.join(
        repoRoot,
        'src',
        'localization',
        `${locale}.json`
    );
    const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const notifications = source.notifications || {};
    const entries = {};

    for (const key of keys) {
        const value = notifications[key];
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing notifications.${key}`);
        }
        entries[`notifications.${key}`] = value;
    }
    for (const [outputKey, sourcePath] of pathKeys) {
        const value = readPath(source, sourcePath);
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing ${outputKey}`);
        }
        entries[outputKey] = value;
    }

    overlayCatalog.locales[locale] = entries;
}

writeCatalog(overlayOutputPath, overlayCatalog);

const shellCatalog = createCatalog();

for (const locale of shellLocales) {
    const inputPath = path.join(
        repoRoot,
        'src',
        'localization',
        `${locale}.json`
    );
    const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const entries = {};

    for (const [outputKey, sourcePath] of shellPathKeys) {
        const value = readPath(source, sourcePath);
        if (typeof value !== 'string') {
            throw new Error(`${inputPath} is missing ${outputKey}`);
        }
        entries[outputKey] = value;
    }
    if (shellMenuLabels[locale]) {
        Object.assign(entries, shellMenuLabels[locale]);
    }

    shellCatalog.locales[locale] = entries;
}

writeCatalog(shellOutputPath, shellCatalog);

function readPath(source, sourcePath) {
    return sourcePath.reduce((value, key) => {
        if (value && typeof value === 'object') {
            return value[key];
        }
        return undefined;
    }, source);
}

function createCatalog() {
    return {
        version: 1,
        fallbackLocale: 'en',
        locales: {}
    };
}

function writeCatalog(outputPath, catalog) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 4)}\n`);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
