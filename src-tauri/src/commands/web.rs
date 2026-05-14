#![allow(non_snake_case)]

use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn web__clear_cookies(state: State<'_, AppState>) -> Result<(), AppError> {
    state.web.clear_cookies();
    state.web.save_cookies(&state.db);
    Ok(())
}

#[tauri::command]
pub async fn web__get_cookies(state: State<'_, AppState>) -> Result<String, AppError> {
    state.web.save_cookies(&state.db);
    Err(AppError::Custom(
        "Raw cookie export is disabled for renderer commands.".into(),
    ))
}

#[tauri::command]
pub async fn web__set_cookies(state: State<'_, AppState>, cookies: String) -> Result<(), AppError> {
    vrcx_0_vrchat_client::web_client::validate_vrchat_cookies_b64(&cookies)
        .map_err(|error| AppError::Custom(error.to_string()))?;
    state
        .web
        .set_cookies(&cookies)
        .map_err(|error| AppError::Custom(error.to_string()))?;
    state.web.save_cookies(&state.db);
    Ok(())
}
