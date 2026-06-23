#![allow(non_snake_case)]

use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub async fn web__clear_cookies(state: State<'_, AppState>) -> Result<(), AppError> {
    state.web.clear_cookies();
    state.web.save_cookies(&state.db);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn web__clear_auth_cookies(state: State<'_, AppState>) -> Result<(), AppError> {
    state.web.clear_auth_cookies();
    state.web.save_cookies(&state.db);
    Ok(())
}
