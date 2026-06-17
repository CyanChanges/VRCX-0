#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_core::json::RawJson;

use crate::error::AppError;
use crate::state::AppState;

use vrcx_0_persistence::feed::{
    FeedLiveRowsMergeInput, FeedReadModelOutput, FeedReadModelQueryInput, FeedRowOutput,
    FeedRowsQueryInput,
};

#[tauri::command]
#[specta::specta]
pub fn app__feed_add_entry(
    state: State<'_, AppState>,
    user_id: String,
    entry: RawJson,
) -> Result<(), AppError> {
    vrcx_0_persistence::feed::feed_add_entry(state.db.as_ref(), user_id, entry)
        .map_err(AppError::from)
}

#[tauri::command]
#[specta::specta]
pub fn app__feed_avatar_purge(
    state: State<'_, AppState>,
    user_id: String,
    cutoff_date: Option<String>,
) -> Result<i64, AppError> {
    vrcx_0_persistence::feed::feed_avatar_purge(state.db.as_ref(), user_id, cutoff_date)
        .map_err(AppError::from)
}

#[tauri::command]
#[specta::specta]
pub fn app__feed_live_rows_merge(query: FeedLiveRowsMergeInput) -> FeedReadModelOutput {
    vrcx_0_persistence::feed::feed_live_rows_merge(query)
}

#[tauri::command]
#[specta::specta]
pub fn app__feed_read_model_query(
    state: State<'_, AppState>,
    query: FeedReadModelQueryInput,
) -> Result<FeedReadModelOutput, AppError> {
    vrcx_0_persistence::feed::feed_read_model_query(state.db.as_ref(), query)
        .map_err(AppError::from)
}

#[tauri::command]
#[specta::specta]
pub fn app__feed_rows_query(
    state: State<'_, AppState>,
    query: FeedRowsQueryInput,
) -> Result<Vec<FeedRowOutput>, AppError> {
    vrcx_0_persistence::feed::feed_rows_query(state.db.as_ref(), query).map_err(AppError::from)
}
