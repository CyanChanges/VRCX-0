#![allow(non_snake_case)]

use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

use super::app::host_capabilities::{require_host_capability, HostCapability};

#[tauri::command]
pub fn log_watcher__get(state: State<'_, AppState>) -> Result<Vec<Vec<String>>, AppError> {
    require_host_capability(HostCapability::GameLogWatcher)?;
    Ok(state.log_watcher.get())
}

#[tauri::command]
pub fn log_watcher__set_date_till(
    date: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    require_host_capability(HostCapability::GameLogWatcher)?;
    state.log_watcher.set_date_till(&date);
    Ok(())
}

#[tauri::command]
pub fn log_watcher__reset(state: State<'_, AppState>) -> Result<(), AppError> {
    require_host_capability(HostCapability::GameLogWatcher)?;
    state.log_watcher.reset();
    Ok(())
}

#[tauri::command]
pub fn log_watcher__vrc_closed_gracefully(state: State<'_, AppState>) -> Result<bool, AppError> {
    require_host_capability(HostCapability::GameLogWatcher)?;
    Ok(state.log_watcher.vrc_closed_gracefully())
}
