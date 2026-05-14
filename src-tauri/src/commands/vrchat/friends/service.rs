#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_application::vrchat_api::friends::{
    friend_delete_input, friend_request_cancel_input, friend_request_send_input,
    friend_status_get_input, friends_get_input,
};

use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_application::vrchat_api::{VrchatApiRequest, VrchatApiResponse};

use super::types::{VrchatFriendCancelRequestInput, VrchatFriendUserInput, VrchatFriendsGetInput};

async fn execute_friend_api(
    state: State<'_, AppState>,
    command: &str,
    detail: impl Into<String>,
    input: VrchatApiRequest,
) -> Result<VrchatApiResponse, AppError> {
    let diagnostics = state.runtime_context.diagnostics.clone();
    diagnostics.record_command(command, "running", detail.into());
    let result = super::super::execute::execute_vrchat_friend_api(state, input).await;
    match &result {
        Ok(response) => {
            diagnostics.record_command(command, "ok", format!("status={}", response.status));
        }
        Err(error) => diagnostics.record_command(command, "error", error.to_string()),
    }
    result
}

#[tauri::command]
pub async fn app__vrchat_friends_get(
    state: State<'_, AppState>,
    input: VrchatFriendsGetInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_friend_api(
        state,
        "app__vrchat_friends_get",
        format!("Getting friends offset {}.", input.offset),
        friends_get_input(input.endpoint, input.offline, input.n, input.offset),
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_friend_status_get(
    state: State<'_, AppState>,
    input: VrchatFriendUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) = friend_status_get_input(input.endpoint, input.user_id)?;
    execute_friend_api(
        state,
        "app__vrchat_friend_status_get",
        format!("Getting friend status for {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_friend_delete(
    state: State<'_, AppState>,
    input: VrchatFriendUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) = friend_delete_input(input.endpoint, input.user_id)?;
    execute_friend_api(
        state,
        "app__vrchat_friend_delete",
        format!("Deleting friend {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_friend_request_send(
    state: State<'_, AppState>,
    input: VrchatFriendUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) = friend_request_send_input(input.endpoint, input.user_id)?;
    execute_friend_api(
        state,
        "app__vrchat_friend_request_send",
        format!("Sending friend request to {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_friend_request_cancel(
    state: State<'_, AppState>,
    input: VrchatFriendCancelRequestInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) =
        friend_request_cancel_input(input.endpoint, input.user_id, input.notification_id)?;
    execute_friend_api(
        state,
        "app__vrchat_friend_request_cancel",
        format!("Cancelling friend request for {user_id}."),
        request,
    )
    .await
}
