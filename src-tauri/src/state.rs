use std::sync::Arc;

use crate::adapters::application::context::RuntimeHostContext;
use crate::adapters::application::game_client::GameClientHostRuntime;
use crate::adapters::application::game_log::GameLogHostRuntime;
use crate::adapters::host_file_access::HostFileAccess;
use crate::adapters::ipc::{IpcEventSink, IpcServer};
use crate::adapters::log_watcher::{
    GameLogEventSink, HostLogLocationSnapshotScanner, LogWatcher, LogWatcherCompatBridge,
};
use crate::error::AppError;
use vrcx_0_application::ImageCache;
use vrcx_0_application::ProcessMonitor;
use vrcx_0_application::SessionHostRuntime;
use vrcx_0_application::WebClient;
use vrcx_0_application::{RealtimeHostRuntime, RealtimeHostRuntimeDeps};
use vrcx_0_host::app_paths::AppPaths;
use vrcx_0_host::auto_launch::AutoAppLaunchManager;
use vrcx_0_host::discord_rpc::DiscordRpc;
use vrcx_0_persistence::legacy_migration::{
    cleanup_legacy_updater_files, consume_pending_legacy_migration, LegacyMigrationPaths,
};
use vrcx_0_persistence::legacy_vrcx::{LegacyVrcxMigrationStatus, LegacyVrcxSource};
use vrcx_0_persistence::screenshot_cache::MetadataCacheDb;
use vrcx_0_persistence::storage::StorageService;
use vrcx_0_persistence::DatabaseService;

pub struct AppState {
    pub paths: AppPaths,
    pub storage: StorageService,
    pub db: Arc<DatabaseService>,
    pub discord_rpc: DiscordRpc,
    pub process_monitor: ProcessMonitor,
    pub log_watcher: LogWatcher,
    pub log_watcher_compat_bridge: LogWatcherCompatBridge,
    pub runtime_context: Arc<RuntimeHostContext>,
    pub game_log_runtime: Arc<GameLogHostRuntime>,
    pub game_client_runtime: Arc<GameClientHostRuntime>,
    pub realtime_runtime: Arc<RealtimeHostRuntime>,
    pub session_runtime: Arc<SessionHostRuntime>,
    pub web: Arc<WebClient>,
    pub image_cache: Arc<ImageCache>,
    pub host_file_access: HostFileAccess,
    pub ipc: IpcServer,
    pub screenshot_cache: MetadataCacheDb,

    pub auto_launch: AutoAppLaunchManager,
    pub legacy_vrcx_available: bool,
    pub legacy_vrcx_source: Option<LegacyVrcxSource>,
    pub legacy_vrcx_migration_status: LegacyVrcxMigrationStatus,
    pub launched_from_autostart: bool,
}

impl AppState {
    pub fn new() -> Result<Self, AppError> {
        let paths = AppPaths::resolve()?;
        cleanup_legacy_updater_files(&paths.app_data);
        let launched_from_autostart = std::env::args().any(|arg| arg == "--autostart");

        let migration_paths = LegacyMigrationPaths::from_app_data(paths.app_data.clone());
        consume_pending_legacy_migration(&migration_paths)?;

        let (legacy_vrcx_source, legacy_vrcx_migration_status) =
            vrcx_0_persistence::legacy_vrcx::discover_legacy_vrcx_migration(
                &paths.db_file,
                &paths.config_file,
            );
        let legacy_vrcx_available = legacy_vrcx_migration_status.available;

        let storage = StorageService::new(&paths.config_file)?;

        let db = Arc::new(DatabaseService::new(&paths.db_file)?);
        let discord_rpc = DiscordRpc::new();
        let process_monitor = ProcessMonitor::new();
        let web = Arc::new(WebClient::new(&storage, &db, realtime_origin())?);
        let image_fetcher = web.image_fetcher()?;
        let image_cache = Arc::new(ImageCache::new(paths.image_cache.clone(), image_fetcher)?);
        let host_file_access = HostFileAccess::new();
        let runtime_context = Arc::new(RuntimeHostContext::new(
            Arc::clone(&db),
            Arc::clone(&web),
            Arc::clone(&image_cache),
        ));
        let game_log_runtime = Arc::new(GameLogHostRuntime::new(
            Arc::clone(&runtime_context),
            host_file_access.clone(),
            paths.clone(),
        ));
        let game_log_sink: Arc<dyn GameLogEventSink> = game_log_runtime.clone();
        let log_watcher = LogWatcher::new_with_location_snapshot_scanner(
            Some(game_log_sink),
            Arc::new(HostLogLocationSnapshotScanner),
        );
        let log_watcher_compat_bridge = LogWatcherCompatBridge::new();
        let game_client_runtime = Arc::new(GameClientHostRuntime::new(
            Arc::clone(&runtime_context),
            log_watcher.clone(),
            host_file_access.clone(),
            paths.clone(),
        ));
        let realtime_runtime = Arc::new(RealtimeHostRuntime::new(RealtimeHostRuntimeDeps {
            db: Arc::clone(&runtime_context.db),
            web: Arc::clone(&runtime_context.web),
            event_bus: runtime_context.event_bus.clone(),
            sync: runtime_context.sync.clone(),
            tasks: runtime_context.tasks.clone(),
            session: runtime_context.session.clone(),
            game_log_snapshot: runtime_context.game_log_snapshot_handle(),
        }));
        let session_runtime = Arc::new(SessionHostRuntime::new(
            runtime_context.session.clone(),
            runtime_context.event_bus.clone(),
        ));
        let ipc_sink: Arc<dyn IpcEventSink> = game_client_runtime.clone();
        let ipc = IpcServer::new(Some(ipc_sink));
        let screenshot_cache = MetadataCacheDb::new(&paths.app_data.join("metadataCache.db"))?;

        let auto_launch = AutoAppLaunchManager::new(&paths.app_data);

        Ok(Self {
            paths,
            storage,
            db,
            discord_rpc,
            process_monitor,
            log_watcher,
            log_watcher_compat_bridge,
            runtime_context,
            game_log_runtime,
            game_client_runtime,
            realtime_runtime,
            session_runtime,
            web,
            image_cache,
            host_file_access,
            ipc,
            screenshot_cache,
            auto_launch,
            legacy_vrcx_available,
            legacy_vrcx_source,
            legacy_vrcx_migration_status,
            launched_from_autostart,
        })
    }
}

fn realtime_origin() -> String {
    if cfg!(debug_assertions) {
        "http://localhost:9000".into()
    } else {
        "http://tauri.localhost".into()
    }
}
