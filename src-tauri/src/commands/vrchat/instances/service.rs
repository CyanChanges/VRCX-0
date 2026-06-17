#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_application::vrchat_api::instances::{
    instance_close_input, instance_create_input, instance_get_input, instance_self_invite_input,
    instance_short_name_get_input,
};

use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_application::vrchat_api::{VrchatApiRequest, VrchatApiResponse};

use super::types::{
    VrchatInstanceCloseInput, VrchatInstanceCreateInput, VrchatInstanceIdentityInput,
    VrchatInstanceSelfInviteInput, VrchatInstanceShortNameInput,
};

async fn execute_instance_api(
    state: State<'_, AppState>,
    command: &str,
    detail: impl Into<String>,
    input: VrchatApiRequest,
) -> Result<VrchatApiResponse, AppError> {
    let diagnostics = state.runtime_context.diagnostics.clone();
    diagnostics.record_command(command, "running", detail.into());
    let result = super::super::execute::execute_vrchat_instance_api(state, input).await;
    match &result {
        Ok(response) => {
            diagnostics.record_command(command, "ok", format!("status={}", response.status));
        }
        Err(error) => diagnostics.record_command(command, "error", error.to_string()),
    }
    result
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_instance_get(
    state: State<'_, AppState>,
    input: VrchatInstanceIdentityInput,
) -> Result<VrchatApiResponse, AppError> {
    let (world_id, instance_id, request) =
        instance_get_input(input.endpoint, input.world_id, input.instance_id)?;
    execute_instance_api(
        state,
        "app__vrchat_instance_get",
        format!("Getting instance {world_id}:{instance_id}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_instance_short_name_get(
    state: State<'_, AppState>,
    input: VrchatInstanceShortNameInput,
) -> Result<VrchatApiResponse, AppError> {
    let (world_id, instance_id, request) = instance_short_name_get_input(
        input.endpoint,
        input.world_id,
        input.instance_id,
        input.short_name,
    )?;
    execute_instance_api(
        state,
        "app__vrchat_instance_short_name_get",
        format!("Getting short name for instance {world_id}:{instance_id}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_instance_create(
    state: State<'_, AppState>,
    input: VrchatInstanceCreateInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_instance_api(
        state,
        "app__vrchat_instance_create",
        "Creating instance.",
        instance_create_input(input.endpoint, input.params),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_instance_self_invite(
    state: State<'_, AppState>,
    input: VrchatInstanceSelfInviteInput,
) -> Result<VrchatApiResponse, AppError> {
    let (world_id, instance_id, request) = instance_self_invite_input(
        input.endpoint,
        input.world_id,
        input.instance_id,
        input.short_name,
    )?;
    execute_instance_api(
        state,
        "app__vrchat_instance_self_invite",
        format!("Sending self invite for {world_id}:{instance_id}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_instance_close(
    state: State<'_, AppState>,
    input: VrchatInstanceCloseInput,
) -> Result<VrchatApiResponse, AppError> {
    let (location, request) =
        instance_close_input(input.endpoint, input.location, input.hard_close)?;
    execute_instance_api(
        state,
        "app__vrchat_instance_close",
        format!("Closing instance {location}."),
        request,
    )
    .await
}
