#![allow(non_snake_case)]

use tauri::{AppHandle, Manager, State};

use crate::bootstrap;
use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_application::{BackendRuntimeMode, BackendRuntimePhase, BackendRuntimeSnapshot};

#[tauri::command]
pub async fn app__start_background_mode(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<BackendRuntimeSnapshot, AppError> {
    let snapshot = state
        .start_backend_runtime(BackendRuntimeMode::Background)
        .await?;
    if snapshot.mode == BackendRuntimeMode::Background
        && snapshot.phase == BackendRuntimePhase::Running
    {
        destroy_main_window(&app_handle);
    }
    refresh_tray_menu(&app_handle, &state);
    Ok(snapshot)
}

#[tauri::command]
pub fn app__stop_background_mode(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    reason: Option<String>,
) -> Result<BackendRuntimeSnapshot, AppError> {
    let current = state.snapshot_backend_runtime();
    if current.mode != BackendRuntimeMode::Background
        || current.phase != BackendRuntimePhase::Running
    {
        return Ok(current);
    }

    state.log_watcher_compat_bridge.stop();
    let snapshot = state.stop_backend_runtime(reason.unwrap_or_else(|| "user".into()));
    if let Some(tray) = app_handle.tray_by_id("main") {
        let _ = tray.set_tooltip(Some("VRCX-0"));
    }
    refresh_tray_menu(&app_handle, &state);
    bootstrap::ensure_main_window(&app_handle)
        .map_err(|error| AppError::Custom(format!("ensure main window: {error}")))?;
    Ok(snapshot)
}

#[tauri::command]
pub fn app__get_backend_runtime_snapshot(
    state: State<'_, AppState>,
) -> Result<BackendRuntimeSnapshot, AppError> {
    Ok(state.snapshot_backend_runtime())
}

#[tauri::command]
pub fn app__ensure_main_window(app_handle: AppHandle) -> Result<(), AppError> {
    bootstrap::ensure_main_window(&app_handle)
        .map_err(|error| AppError::Custom(format!("ensure main window: {error}")))
}

fn destroy_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if let Err(error) = window.destroy() {
            tracing::warn!(error = %error, "failed to destroy main window for background mode");
            let _ = window.hide();
            let _ = window.set_skip_taskbar(true);
        }
    }
}

fn refresh_tray_menu(app_handle: &AppHandle, state: &AppState) {
    if let Err(error) = bootstrap::refresh_tray_menu(app_handle, state) {
        tracing::warn!(error = %error, "failed to refresh tray background mode item");
    }
}
