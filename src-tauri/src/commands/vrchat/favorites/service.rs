#![allow(non_snake_case)]

use serde_json::{json, Value};
use tauri::State;
use vrcx_0_application::vrchat_api::favorites::{
    favorite_add_input, favorite_avatars_get_input, favorite_delete_input,
    favorite_group_clear_input, favorite_group_save_input, favorite_groups_get_input,
    favorite_limits_get_input, favorite_worlds_get_input, favorites_get_input,
};
use vrcx_0_application::vrchat_api::{normalize_text, require_text};
use vrcx_0_persistence::config::ConfigRepository;

use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_application::vrchat_api::{VrchatApiRequest, VrchatApiResponse};

use super::types::{
    LocalFavoriteGroupInput, LocalFavoriteGroupRenameInput, LocalFavoriteInput,
    VrchatFavoriteAddInput, VrchatFavoriteAvatarsInput, VrchatFavoriteDeleteInput,
    VrchatFavoriteEndpointInput, VrchatFavoriteGroupClearInput, VrchatFavoriteGroupSaveInput,
    VrchatFavoriteGroupsInput, VrchatFavoritePagedInput, VrchatFavoriteWorldsInput,
};

async fn execute_favorite_api(
    state: State<'_, AppState>,
    command: &str,
    detail: impl Into<String>,
    input: VrchatApiRequest,
) -> Result<VrchatApiResponse, AppError> {
    let diagnostics = state.runtime_context.diagnostics.clone();
    diagnostics.record_command(command, "running", detail.into());
    let result = super::super::execute::execute_vrchat_favorite_api(state, input).await;
    match &result {
        Ok(response) => {
            diagnostics.record_command(command, "ok", format!("status={}", response.status));
        }
        Err(error) => {
            diagnostics.record_command(command, "error", error.to_string());
        }
    }
    result
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_limits_get(
    state: State<'_, AppState>,
    input: VrchatFavoriteEndpointInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_favorite_api(
        state,
        "app__vrchat_favorite_limits_get",
        "Getting favorite limits.",
        favorite_limits_get_input(input.endpoint),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorites_get(
    state: State<'_, AppState>,
    input: VrchatFavoritePagedInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_favorite_api(
        state,
        "app__vrchat_favorites_get",
        format!("Getting favorites offset {}.", input.offset),
        favorites_get_input(input.endpoint, input.n, input.offset),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_worlds_get(
    state: State<'_, AppState>,
    input: VrchatFavoriteWorldsInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_favorite_api(
        state,
        "app__vrchat_favorite_worlds_get",
        format!("Getting favorite worlds offset {}.", input.offset),
        favorite_worlds_get_input(
            input.endpoint,
            input.n,
            input.offset,
            input.owner_id,
            input.user_id,
            input.tag,
        ),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_avatars_get(
    state: State<'_, AppState>,
    input: VrchatFavoriteAvatarsInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_favorite_api(
        state,
        "app__vrchat_favorite_avatars_get",
        format!("Getting favorite avatars offset {}.", input.offset),
        favorite_avatars_get_input(input.endpoint, input.n, input.offset, input.tag),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_groups_get(
    state: State<'_, AppState>,
    input: VrchatFavoriteGroupsInput,
) -> Result<VrchatApiResponse, AppError> {
    execute_favorite_api(
        state,
        "app__vrchat_favorite_groups_get",
        format!("Getting favorite groups offset {}.", input.offset),
        favorite_groups_get_input(input.endpoint, input.n, input.offset, input.owner_id),
    )
    .await
}

fn local_group_config_key(kind: &str) -> Result<&'static str, AppError> {
    match kind.trim() {
        "friend" => Ok("localFavoriteFriendGroups"),
        "avatar" => Ok("localFavoriteAvatarGroups"),
        "world" => Ok("localFavoriteWorldGroups"),
        _ => Err(AppError::Custom("unsupported favorite kind".into())),
    }
}

fn read_config_array(state: &State<'_, AppState>, key: &str) -> Result<Vec<String>, AppError> {
    let parsed = ConfigRepository::new(state.db.clone())
        .get_json(key, Value::Null)
        .map_err(AppError::from)?;
    let mut values = parsed
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(value_as_string)
                .map(normalize_text)
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    values.sort();
    values.dedup();
    Ok(values)
}

fn value_as_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

fn write_config_array(
    state: State<'_, AppState>,
    key: &str,
    values: Vec<String>,
) -> Result<(), AppError> {
    ConfigRepository::new(state.db.clone())
        .set_json(key, &json!(values))
        .map_err(AppError::from)
}

fn add_group_value(groups: &mut Vec<String>, group_name: String) {
    if !groups.iter().any(|value| value == &group_name) {
        groups.push(group_name);
    }
    groups.sort();
    groups.dedup();
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_add(
    state: State<'_, AppState>,
    input: VrchatFavoriteAddInput,
) -> Result<VrchatApiResponse, AppError> {
    let (type_name, favorite_id, request) = favorite_add_input(
        input.endpoint,
        input.type_name,
        input.favorite_id,
        input.tags,
    )?;
    execute_favorite_api(
        state,
        "app__vrchat_favorite_add",
        format!("Adding {type_name} favorite {favorite_id}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_delete(
    state: State<'_, AppState>,
    input: VrchatFavoriteDeleteInput,
) -> Result<VrchatApiResponse, AppError> {
    let (object_id, request) = favorite_delete_input(input.endpoint, input.object_id)?;
    execute_favorite_api(
        state,
        "app__vrchat_favorite_delete",
        format!("Deleting favorite for {object_id}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_group_save(
    state: State<'_, AppState>,
    input: VrchatFavoriteGroupSaveInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group, request) = favorite_group_save_input(
        input.endpoint,
        input.owner_id,
        input.type_name,
        input.group,
        input.display_name,
        input.visibility,
    )?;
    execute_favorite_api(
        state,
        "app__vrchat_favorite_group_save",
        format!("Saving favorite group {group}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__vrchat_favorite_group_clear(
    state: State<'_, AppState>,
    input: VrchatFavoriteGroupClearInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group, request) =
        favorite_group_clear_input(input.endpoint, input.owner_id, input.type_name, input.group)?;
    execute_favorite_api(
        state,
        "app__vrchat_favorite_group_clear",
        format!("Clearing favorite group {group}."),
        request,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub fn app__local_favorite_add(
    state: State<'_, AppState>,
    input: LocalFavoriteInput,
) -> Result<i64, AppError> {
    let kind = require_text(input.kind, "LocalFavoriteAdd requires kind.")?;
    let entity_id = require_text(input.entity_id, "LocalFavoriteAdd requires entityId.")?;
    let group_name = require_text(input.group_name, "LocalFavoriteAdd requires groupName.")?;
    crate::commands::local::favorites::app__favorite_add(state, kind, entity_id, group_name)
}

#[tauri::command]
#[specta::specta]
pub fn app__local_favorite_remove(
    state: State<'_, AppState>,
    input: LocalFavoriteInput,
) -> Result<i64, AppError> {
    let kind = require_text(input.kind, "LocalFavoriteRemove requires kind.")?;
    let entity_id = require_text(input.entity_id, "LocalFavoriteRemove requires entityId.")?;
    let group_name = require_text(input.group_name, "LocalFavoriteRemove requires groupName.")?;
    crate::commands::local::favorites::app__favorite_remove(state, kind, entity_id, group_name)
}

#[tauri::command]
#[specta::specta]
pub fn app__local_favorite_group_create(
    state: State<'_, AppState>,
    input: LocalFavoriteGroupInput,
) -> Result<(), AppError> {
    let kind = require_text(input.kind, "LocalFavoriteGroupCreate requires kind.")?;
    let group_name = require_text(
        input.group_name,
        "LocalFavoriteGroupCreate requires groupName.",
    )?;
    let key = local_group_config_key(&kind)?;
    let mut groups = read_config_array(&state, key)?;
    add_group_value(&mut groups, group_name);
    write_config_array(state, key, groups)
}

#[tauri::command]
#[specta::specta]
pub fn app__local_favorite_group_rename(
    state: State<'_, AppState>,
    input: LocalFavoriteGroupRenameInput,
) -> Result<i64, AppError> {
    let kind = require_text(input.kind, "LocalFavoriteGroupRename requires kind.")?;
    let group_name = require_text(
        input.group_name,
        "LocalFavoriteGroupRename requires groupName.",
    )?;
    let new_group_name = require_text(
        input.new_group_name,
        "LocalFavoriteGroupRename requires newGroupName.",
    )?;
    let key = local_group_config_key(&kind)?;
    let result = crate::commands::local::favorites::app__favorite_group_rename(
        state.clone(),
        kind,
        group_name.clone(),
        new_group_name.clone(),
    )?;
    let mut groups = read_config_array(&state, key)?
        .into_iter()
        .filter(|value| value != &group_name)
        .collect::<Vec<_>>();
    add_group_value(&mut groups, new_group_name);
    write_config_array(state, key, groups)?;
    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub fn app__local_favorite_group_delete(
    state: State<'_, AppState>,
    input: LocalFavoriteGroupInput,
) -> Result<i64, AppError> {
    let kind = require_text(input.kind, "LocalFavoriteGroupDelete requires kind.")?;
    let group_name = require_text(
        input.group_name,
        "LocalFavoriteGroupDelete requires groupName.",
    )?;
    let key = local_group_config_key(&kind)?;
    let result = crate::commands::local::favorites::app__favorite_group_delete(
        state.clone(),
        kind,
        group_name.clone(),
    )?;
    let groups = read_config_array(&state, key)?
        .into_iter()
        .filter(|value| value != &group_name)
        .collect::<Vec<_>>();
    write_config_array(state, key, groups)?;
    Ok(result)
}
