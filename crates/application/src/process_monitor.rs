use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use crate::log_watcher::LogWatcher;
pub use vrcx_0_core::game_process::GameProcessEvent;

pub trait GameProcessEventSink: Send + Sync {
    fn on_game_process_event(&self, event: GameProcessEvent) -> crate::Result<()>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct GameProcessStatus {
    pub is_game_running: bool,
    pub is_steamvr_running: bool,
}

pub trait GameProcessMonitorActions: Send + 'static {
    fn detect(&mut self) -> GameProcessStatus;
    fn on_game_started(&mut self, steamvr_running: bool);
    fn on_game_stopped(&mut self);
}

pub struct ProcessMonitor {
    game_running: Arc<AtomicBool>,
    steamvr_running: Arc<AtomicBool>,
    started: Arc<AtomicBool>,
    stop_requested: Arc<AtomicBool>,
    generation: Arc<AtomicU64>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl ProcessMonitor {
    pub fn new() -> Self {
        Self {
            game_running: Arc::new(AtomicBool::new(false)),
            steamvr_running: Arc::new(AtomicBool::new(false)),
            started: Arc::new(AtomicBool::new(false)),
            stop_requested: Arc::new(AtomicBool::new(false)),
            generation: Arc::new(AtomicU64::new(0)),
            handle: Mutex::new(None),
        }
    }

    pub fn start(
        &self,
        actions: impl GameProcessMonitorActions,
        log_watcher: LogWatcher,
        game_process_sinks: Vec<Arc<dyn GameProcessEventSink>>,
    ) {
        if self
            .started
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
            && !self.stop_requested.load(Ordering::Acquire)
        {
            tracing::debug!("process monitor is already active");
            return;
        }
        let generation = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        self.stop_requested.store(false, Ordering::Release);

        let game = Arc::clone(&self.game_running);
        let steamvr = Arc::clone(&self.steamvr_running);
        let started = Arc::clone(&self.started);
        let stop_requested = Arc::clone(&self.stop_requested);
        let current_generation = Arc::clone(&self.generation);

        let handle = std::thread::spawn(move || {
            let mut actions = actions;
            let mut first_poll = true;

            while !stop_requested.load(Ordering::Acquire)
                && current_generation.load(Ordering::Acquire) == generation
            {
                let status = actions.detect();
                let game_found = status.is_game_running;
                let steamvr_found = status.is_steamvr_running;

                let prev_game = game.swap(game_found, Ordering::Relaxed);
                let prev_steamvr = steamvr.swap(steamvr_found, Ordering::Relaxed);
                let game_changed = prev_game != game_found;
                let steamvr_changed = prev_steamvr != steamvr_found;

                if first_poll || game_changed {
                    log_watcher.set_game_running(game_found);
                }

                if first_poll || game_changed || steamvr_changed {
                    for sink in &game_process_sinks {
                        if let Err(error) = sink.on_game_process_event(GameProcessEvent {
                            is_game_running: game_found,
                            is_steamvr_running: steamvr_found,
                            game_changed,
                        }) {
                            tracing::warn!("failed to handle game process event: {error}");
                        }
                    }
                }

                if first_poll {
                    first_poll = false;
                } else if game_changed {
                    if game_found {
                        actions.on_game_started(steamvr_found);
                    } else {
                        actions.on_game_stopped();
                    }
                }

                std::thread::sleep(Duration::from_secs(1));
            }

            if current_generation.load(Ordering::Acquire) == generation {
                started.store(false, Ordering::Release);
            }
        });
        if let Ok(mut current) = self.handle.lock() {
            if let Some(previous) = current.take() {
                if previous.is_finished() {
                    let _ = previous.join();
                }
            }
            *current = Some(handle);
        }
    }

    pub fn stop(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        self.stop_requested.store(true, Ordering::Release);
        self.started.store(false, Ordering::Release);
        if let Ok(mut handle) = self.handle.lock() {
            if let Some(handle) = handle.take() {
                let _ = handle.join();
            }
        }
    }

    pub fn is_game_running(&self) -> bool {
        self.game_running.load(Ordering::Relaxed)
    }

    pub fn is_steamvr_running(&self) -> bool {
        self.steamvr_running.load(Ordering::Relaxed)
    }
}

impl Default for ProcessMonitor {
    fn default() -> Self {
        Self::new()
    }
}
