#![allow(non_snake_case)]

use std::path::PathBuf;

use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "linux")]
use crate::domain::vrchat_paths;
use crate::error::AppError;
use crate::state::AppState;

use super::host_capabilities::{
    require_host_capability, require_host_capability_supported, HostCapability,
};
#[cfg(target_os = "windows")]
use super::paths::get_steam_path;

#[tauri::command]
pub fn app__check_game_running(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    require_host_capability(HostCapability::GameProcessMonitor)?;
    let _ = app_handle.emit(
        "updateIsGameRunning",
        serde_json::json!({
            "isGameRunning": state.process_monitor.is_game_running(),
            "isSteamVRRunning": state.process_monitor.is_steamvr_running(),
        }),
    );
    Ok(())
}

#[tauri::command]
pub fn app__is_game_running(state: State<'_, AppState>) -> Result<bool, AppError> {
    require_host_capability(HostCapability::GameProcessMonitor)?;
    Ok(state.process_monitor.is_game_running())
}

#[tauri::command]
pub fn app__is_steamvr_running(state: State<'_, AppState>) -> Result<bool, AppError> {
    require_host_capability(HostCapability::GameProcessMonitor)?;
    Ok(state.process_monitor.is_steamvr_running())
}

#[tauri::command]
pub fn app__quit_game() -> Result<i32, AppError> {
    require_host_capability_supported(HostCapability::GameLaunch)?;
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut count = 0i32;
    for process in sys.processes().values() {
        if process
            .name()
            .to_string_lossy()
            .eq_ignore_ascii_case("VRChat.exe")
        {
            process.kill();
            count += 1;
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn app__start_game(arguments: String) -> Result<bool, AppError> {
    require_host_capability(HostCapability::GameLaunch)?;
    #[cfg(target_os = "linux")]
    {
        return start_game_linux(&arguments);
    }

    #[cfg(target_os = "windows")]
    {
        start_game_windows(&arguments)
    }

    #[cfg(target_os = "macos")]
    {
        Err(AppError::Custom(
            "Game launch is not supported on macOS".into(),
        ))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Err(AppError::Custom(format!(
            "Game launch is not supported on {}",
            super::host_capabilities::current_platform()
        )))
    }
}

#[cfg(target_os = "windows")]
fn start_game_windows(arguments: &str) -> Result<bool, AppError> {
    let steam_path = get_steam_path();
    if steam_path.is_empty() {
        return Ok(false);
    }
    let steam_exe = PathBuf::from(&steam_path).join("steam.exe");
    if !steam_exe.exists() {
        return Ok(false);
    }

    let mut args = vec!["-applaunch".to_string(), "438100".to_string()];
    if !arguments.is_empty() {
        args.extend(arguments.split_whitespace().map(|s| s.to_string()));
    }

    std::process::Command::new(steam_exe)
        .args(&args)
        .spawn()
        .map_err(|e| AppError::Custom(format!("start game: {e}")))?;

    Ok(true)
}

#[cfg(target_os = "linux")]
fn start_game_linux(arguments: &str) -> Result<bool, AppError> {
    if spawn_steam_app_launch(PathBuf::from("steam"), arguments).is_ok() {
        return Ok(true);
    }

    for steam_sh in vrchat_paths::linux_steam_sh_candidates() {
        if spawn_steam_app_launch(steam_sh, arguments).is_ok() {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(target_os = "linux")]
fn spawn_steam_app_launch(program: PathBuf, arguments: &str) -> Result<(), AppError> {
    let mut args = vec!["-applaunch".to_string(), "438100".to_string()];
    if !arguments.is_empty() {
        args.extend(arguments.split_whitespace().map(|s| s.to_string()));
    }

    std::process::Command::new(program)
        .args(&args)
        .spawn()
        .map_err(|e| AppError::Custom(format!("start game: {e}")))?;

    Ok(())
}

#[tauri::command]
pub fn app__start_game_from_path(path: String, arguments: String) -> Result<bool, AppError> {
    require_host_capability_supported(HostCapability::GameLaunch)?;
    #[cfg(target_os = "linux")]
    {
        let steam_sh = PathBuf::from(&path).join("steam.sh");
        if !steam_sh.is_file() {
            return Ok(false);
        }

        spawn_steam_app_launch(steam_sh, &arguments)?;
        return Ok(true);
    }

    #[cfg(target_os = "windows")]
    {
        let launch_exe = PathBuf::from(&path).join("launch.exe");
        if !launch_exe.exists() {
            return Ok(false);
        }

        let mut cmd = std::process::Command::new(launch_exe);
        if !arguments.is_empty() {
            cmd.args(arguments.split_whitespace());
        }
        cmd.spawn()
            .map_err(|e| AppError::Custom(format!("start game: {e}")))?;

        Ok(true)
    }

    #[cfg(target_os = "macos")]
    {
        Err(AppError::Custom(
            "Game launch is not supported on macOS".into(),
        ))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Err(AppError::Custom(format!(
            "Game launch is not supported on {}",
            super::host_capabilities::current_platform()
        )))
    }
}
