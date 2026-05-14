#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_application::vrchat_api::groups::{
    current_user_group_instances_get_input, gallery_get_input, group_block_input,
    group_get_no_params_input, group_paged_get_input, invite_delete_input, invite_send_input,
    join_input, join_request_respond_input, join_requests_get_input, leave_input, logs_get_input,
    member_ban_input, member_kick_input, member_props_set_input, member_unban_input,
    members_get_input, members_search_input, post_create_input, post_delete_input, post_edit_input,
    profile_get_input, representation_set_input, request_cancel_input, unblock_input,
    user_group_instances_get_input, user_groups_get_input,
};

use crate::error::AppError;
use crate::state::AppState;
use vrcx_0_application::vrchat_api::{VrchatApiRequest, VrchatApiResponse};

use super::types::{
    VrchatGroupGalleryInput, VrchatGroupIdInput, VrchatGroupJoinRequestRespondInput,
    VrchatGroupJoinRequestsInput, VrchatGroupLogsInput, VrchatGroupMemberPropsInput,
    VrchatGroupMembersInput, VrchatGroupMembersSearchInput, VrchatGroupPagedInput,
    VrchatGroupPostCreateInput, VrchatGroupPostDeleteInput, VrchatGroupPostEditInput,
    VrchatGroupProfileInput, VrchatGroupRepresentationInput, VrchatGroupUserGroupsInput,
    VrchatGroupUserInput,
};

async fn execute_group_api(
    state: State<'_, AppState>,
    command: &str,
    detail: impl Into<String>,
    input: VrchatApiRequest,
) -> Result<VrchatApiResponse, AppError> {
    let diagnostics = state.runtime_context.diagnostics.clone();
    diagnostics.record_command(command, "running", detail.into());
    let result = super::super::execute::execute_vrchat_group_api(state, input).await;
    match &result {
        Ok(response) => {
            diagnostics.record_command(command, "ok", format!("status={}", response.status));
        }
        Err(error) => diagnostics.record_command(command, "error", error.to_string()),
    }
    result
}

#[tauri::command]
pub async fn app__vrchat_group_get(
    state: State<'_, AppState>,
    input: VrchatGroupProfileInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) =
        profile_get_input(input.endpoint, input.group_id, input.include_roles)?;
    execute_group_api(
        state,
        "app__vrchat_group_get",
        format!("Getting group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_user_groups_get(
    state: State<'_, AppState>,
    input: VrchatGroupUserGroupsInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) = user_groups_get_input(input.endpoint, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_user_groups_get",
        format!("Getting groups for user {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_posts_get(
    state: State<'_, AppState>,
    input: VrchatGroupPagedInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = group_paged_get_input(
        input.endpoint,
        input.group_id,
        "posts",
        input.n,
        input.offset,
        "VrchatGroupPostsGet requires groupId.",
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_posts_get",
        format!("Getting posts for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_members_get(
    state: State<'_, AppState>,
    input: VrchatGroupMembersInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = members_get_input(
        input.endpoint,
        input.group_id,
        input.n,
        input.offset,
        input.sort,
        input.role_id,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_members_get",
        format!("Getting members for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_members_search(
    state: State<'_, AppState>,
    input: VrchatGroupMembersSearchInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = members_search_input(
        input.endpoint,
        input.group_id,
        input.n,
        input.offset,
        input.query,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_members_search",
        format!("Searching members for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_gallery_get(
    state: State<'_, AppState>,
    input: VrchatGroupGalleryInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, gallery_id, request) = gallery_get_input(
        input.endpoint,
        input.group_id,
        input.gallery_id,
        input.n,
        input.offset,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_gallery_get",
        format!("Getting gallery {gallery_id} for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_instances_get(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        user_group_instances_get_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_instances_get",
        format!("Getting group {group_id} instances for user {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_bans_get(
    state: State<'_, AppState>,
    input: VrchatGroupPagedInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = group_paged_get_input(
        input.endpoint,
        input.group_id,
        "bans",
        input.n,
        input.offset,
        "VrchatGroupBansGet requires groupId.",
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_bans_get",
        format!("Getting bans for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_invites_get(
    state: State<'_, AppState>,
    input: VrchatGroupPagedInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = group_paged_get_input(
        input.endpoint,
        input.group_id,
        "invites",
        input.n,
        input.offset,
        "VrchatGroupInvitesGet requires groupId.",
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_invites_get",
        format!("Getting invites for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_join_requests_get(
    state: State<'_, AppState>,
    input: VrchatGroupJoinRequestsInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = join_requests_get_input(
        input.endpoint,
        input.group_id,
        input.n,
        input.offset,
        input.blocked,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_join_requests_get",
        format!("Getting join requests for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_audit_log_types_get(
    state: State<'_, AppState>,
    input: VrchatGroupIdInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = group_get_no_params_input(
        input.endpoint,
        input.group_id,
        "auditLogTypes",
        "VrchatGroupAuditLogTypesGet requires groupId.",
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_audit_log_types_get",
        format!("Getting audit log types for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_logs_get(
    state: State<'_, AppState>,
    input: VrchatGroupLogsInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = logs_get_input(
        input.endpoint,
        input.group_id,
        input.n,
        input.offset,
        input.event_types,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_logs_get",
        format!("Getting logs for group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_user_instances_get(
    state: State<'_, AppState>,
    input: VrchatGroupUserGroupsInput,
) -> Result<VrchatApiResponse, AppError> {
    let (user_id, request) = current_user_group_instances_get_input(input.endpoint, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_user_instances_get",
        format!("Getting group instances for user {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_post_create(
    state: State<'_, AppState>,
    input: VrchatGroupPostCreateInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = post_create_input(input.endpoint, input.group_id, input.params)?;
    execute_group_api(
        state,
        "app__vrchat_group_post_create",
        format!("Creating post in group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_post_edit(
    state: State<'_, AppState>,
    input: VrchatGroupPostEditInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, post_id, request) =
        post_edit_input(input.endpoint, input.group_id, input.post_id, input.params)?;
    execute_group_api(
        state,
        "app__vrchat_group_post_edit",
        format!("Editing post {post_id} in group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_post_delete(
    state: State<'_, AppState>,
    input: VrchatGroupPostDeleteInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, post_id, request) =
        post_delete_input(input.endpoint, input.group_id, input.post_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_post_delete",
        format!("Deleting post {post_id} in group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_join(
    state: State<'_, AppState>,
    input: VrchatGroupIdInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = join_input(input.endpoint, input.group_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_join",
        format!("Joining group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_leave(
    state: State<'_, AppState>,
    input: VrchatGroupIdInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = leave_input(input.endpoint, input.group_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_leave",
        format!("Leaving group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_request_cancel(
    state: State<'_, AppState>,
    input: VrchatGroupIdInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = request_cancel_input(input.endpoint, input.group_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_request_cancel",
        format!("Canceling group request for {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_invite_send(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        invite_send_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_invite_send",
        format!("Sending group {group_id} invite to {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_member_kick(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        member_kick_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_member_kick",
        format!("Kicking {user_id} from group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_member_ban(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        member_ban_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_member_ban",
        format!("Banning {user_id} from group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_member_unban(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        member_unban_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_member_unban",
        format!("Unbanning {user_id} from group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_invite_delete(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        invite_delete_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_invite_delete",
        format!("Deleting group {group_id} invite for {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_join_request_respond(
    state: State<'_, AppState>,
    input: VrchatGroupJoinRequestRespondInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) = join_request_respond_input(
        input.endpoint,
        input.group_id,
        input.user_id,
        input.action,
        input.block,
    )?;
    execute_group_api(
        state,
        "app__vrchat_group_join_request_respond",
        format!("Responding to group {group_id} join request from {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_representation_set(
    state: State<'_, AppState>,
    input: VrchatGroupRepresentationInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) =
        representation_set_input(input.endpoint, input.group_id, input.is_representing)?;
    execute_group_api(
        state,
        "app__vrchat_group_representation_set",
        format!("Setting group {group_id} representation."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_member_props_set(
    state: State<'_, AppState>,
    input: VrchatGroupMemberPropsInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        member_props_set_input(input.endpoint, input.group_id, input.user_id, input.params)?;
    execute_group_api(
        state,
        "app__vrchat_group_member_props_set",
        format!("Setting group {group_id} member props for {user_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_block(
    state: State<'_, AppState>,
    input: VrchatGroupIdInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, request) = group_block_input(input.endpoint, input.group_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_block",
        format!("Blocking group {group_id}."),
        request,
    )
    .await
}

#[tauri::command]
pub async fn app__vrchat_group_unblock(
    state: State<'_, AppState>,
    input: VrchatGroupUserInput,
) -> Result<VrchatApiResponse, AppError> {
    let (group_id, user_id, request) =
        unblock_input(input.endpoint, input.group_id, input.user_id)?;
    execute_group_api(
        state,
        "app__vrchat_group_unblock",
        format!("Unblocking group {group_id} for {user_id}."),
        request,
    )
    .await
}
