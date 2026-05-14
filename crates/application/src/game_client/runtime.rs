use std::sync::{Arc, Mutex};
#[cfg(any(test, feature = "test-utils"))]
use std::time::Duration;

use vrcx_0_core::ipc::IpcEventDisposition;
use vrcx_0_persistence::config::ConfigRepository;
use vrcx_0_persistence::DatabaseService;

use crate::event_bus::RuntimeEventBus;
use crate::process_monitor::GameProcessEvent;
use crate::session::HostSessionRuntime;
use crate::task_supervisor::TaskSupervisor;
use crate::worker::{RuntimeWorker, RuntimeWorkerOptions};
use crate::{Error, Result};

use super::actions::GameClientActions;
use super::ipc::{parse_ipc_event, ParsedIpcEvent};
use super::processor::{
    GameClientCacheActions, GameClientJob, GameClientLocationSource, GameClientProcessor,
    GameClientProcessorDeps, GameClientState, GameClientWindowActions,
};

#[derive(Clone)]
pub struct GameClientRuntimeDeps {
    pub db: Arc<DatabaseService>,
    pub config: ConfigRepository,
    pub event_bus: RuntimeEventBus,
    pub tasks: TaskSupervisor,
    pub session: HostSessionRuntime,
    pub actions: Arc<dyn GameClientActions>,
    pub cache_actions: Arc<dyn GameClientCacheActions>,
    pub location_source: Arc<dyn GameClientLocationSource>,
    pub window_actions: Arc<dyn GameClientWindowActions>,
}

pub struct GameClientRuntime {
    state: Arc<Mutex<GameClientState>>,
    worker: RuntimeWorker<GameClientJob>,
}

impl GameClientRuntime {
    pub fn new(deps: GameClientRuntimeDeps) -> Self {
        let state = Arc::new(Mutex::new(GameClientState::default()));
        let processor = GameClientProcessor::new(
            GameClientProcessorDeps {
                db: deps.db,
                config: deps.config,
                event_bus: deps.event_bus.clone(),
                tasks: deps.tasks,
                session: deps.session,
                actions: deps.actions,
                cache_actions: deps.cache_actions,
                location_source: deps.location_source,
                window_actions: deps.window_actions,
            },
            Arc::clone(&state),
        );
        let worker_processor = processor.clone();
        let worker = RuntimeWorker::start(
            "game-client",
            RuntimeWorkerOptions::default(),
            deps.event_bus,
            move |jobs| worker_processor.handle_jobs(jobs),
        );

        Self { state, worker }
    }

    pub fn set_runtime_state(&self, session_active: bool, current_location: &str) {
        let Ok(mut state) = self.state.lock() else {
            tracing::warn!("failed to lock GameClient runtime state");
            return;
        };
        state.session_active = session_active;
        state.current_location = current_location.trim().to_string();
    }

    pub fn on_ipc_packet(&self, packet: &str) -> Result<IpcEventDisposition> {
        match parse_ipc_event(packet) {
            Ok(ParsedIpcEvent::MsgPing { version }) => {
                self.state
                    .lock()
                    .map_err(|error| Error::Custom(format!("GameClient state lock: {error}")))?
                    .external_notifier_version = version;
                Ok(IpcEventDisposition::Forward)
            }
            Ok(ParsedIpcEvent::VrcxNoty { message }) => {
                if !self.is_session_active()? {
                    return Ok(IpcEventDisposition::Forward);
                }
                self.enqueue_job(GameClientJob::VrcxNoty {
                    message,
                    fallback_packet: packet.to_string(),
                })?;
                Ok(IpcEventDisposition::Handled)
            }
            Ok(ParsedIpcEvent::VrcxExternal {
                message,
                display_name,
                user_id,
                notify,
            }) => {
                if !self.is_session_active()? {
                    return Ok(IpcEventDisposition::Forward);
                }
                self.enqueue_job(GameClientJob::VrcxExternal {
                    message,
                    display_name,
                    user_id,
                    notify,
                    fallback_packet: packet.to_string(),
                })?;
                Ok(IpcEventDisposition::Handled)
            }
            Ok(ParsedIpcEvent::Forward) | Err(_) => Ok(IpcEventDisposition::Forward),
        }
    }

    pub fn on_game_process_event(&self, event: GameProcessEvent) -> Result<()> {
        if event.game_changed && !event.is_game_running {
            self.enqueue_job(GameClientJob::GameStopped)?;
        }
        Ok(())
    }

    pub fn stop(&self) {
        self.worker.stop();
    }

    fn enqueue_job(&self, job: GameClientJob) -> Result<()> {
        self.worker.push_batch([job])?;
        Ok(())
    }

    fn is_session_active(&self) -> Result<bool> {
        Ok(self
            .state
            .lock()
            .map_err(|error| Error::Custom(format!("GameClient state lock: {error}")))?
            .session_active)
    }

    #[cfg(any(test, feature = "test-utils"))]
    pub fn wait_until_idle(&self) -> bool {
        self.worker.wait_until_idle(Duration::from_secs(2))
    }
}
