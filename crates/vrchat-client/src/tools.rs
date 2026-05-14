use std::collections::HashMap;

use serde_json::{json, Value};

use crate::http_api::{
    api_input, encode_path_segment, get_input, require_text, HttpApiError, HttpApiRequestInput,
};

pub fn calendars_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "calendar", params)
}

pub fn group_calendar_get_input(
    endpoint: String,
    group_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let group_id = require_text(group_id, "VrchatToolsGroupCalendarGet requires groupId.")?;
    Ok((
        group_id.clone(),
        get_input(
            endpoint,
            format!("calendar/{}", encode_path_segment(&group_id)),
            HashMap::new(),
        ),
    ))
}

pub fn following_calendars_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "calendar/following", params)
}

pub fn featured_calendars_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "calendar/featured", params)
}

pub fn group_event_follow_input(
    endpoint: String,
    group_id: String,
    event_id: String,
    is_following: bool,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let group_id = require_text(group_id, "VrchatToolsGroupEventFollow requires groupId.")?;
    let event_id = require_text(event_id, "VrchatToolsGroupEventFollow requires eventId.")?;
    Ok((
        event_id.clone(),
        api_input(
            endpoint,
            "POST",
            format!(
                "calendar/{}/{}/follow",
                encode_path_segment(&group_id),
                encode_path_segment(&event_id)
            ),
            Some(json!({ "isFollowing": is_following })),
        ),
    ))
}

pub fn group_calendar_ics_get_input(
    endpoint: String,
    group_id: String,
    event_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let group_id = require_text(group_id, "VrchatToolsGroupCalendarIcsGet requires groupId.")?;
    let event_id = require_text(event_id, "VrchatToolsGroupCalendarIcsGet requires eventId.")?;
    Ok((
        event_id.clone(),
        get_input(
            endpoint,
            format!(
                "calendar/{}/{}.ics",
                encode_path_segment(&group_id),
                encode_path_segment(&event_id)
            ),
            HashMap::new(),
        ),
    ))
}

pub fn user_note_save_input(
    endpoint: String,
    target_user_id: String,
    note: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let target_user_id = require_text(
        target_user_id,
        "VrchatToolsUserNoteSave requires targetUserId.",
    )?;
    Ok((
        target_user_id.clone(),
        api_input(
            endpoint,
            "POST",
            "userNotes",
            Some(json!({ "targetUserId": target_user_id, "note": note })),
        ),
    ))
}

pub fn user_report_input(
    endpoint: String,
    user_id: String,
    content_type: String,
    reason: String,
    type_name: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatToolsUserReport requires userId.")?;
    let content_type = if content_type.trim().is_empty() {
        "user".to_string()
    } else {
        content_type
    };
    let type_name = if type_name.trim().is_empty() {
        "report".to_string()
    } else {
        type_name
    };
    Ok((
        user_id.clone(),
        api_input(
            endpoint,
            "POST",
            format!("feedback/{}/user", encode_path_segment(&user_id)),
            Some(json!({
                "contentType": content_type,
                "reason": reason,
                "type": type_name,
            })),
        ),
    ))
}

pub fn invite_messages_get_input(
    endpoint: String,
    current_user_id: String,
    message_type: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let current_user_id = require_text(
        current_user_id,
        "VrchatToolsInviteMessagesGet requires currentUserId.",
    )?;
    let message_type = require_text(
        message_type,
        "VrchatToolsInviteMessagesGet requires messageType.",
    )?;
    Ok((
        current_user_id.clone(),
        get_input(
            endpoint,
            format!(
                "message/{}/{}",
                encode_path_segment(&current_user_id),
                encode_path_segment(&message_type)
            ),
            HashMap::new(),
        ),
    ))
}

pub fn invite_message_edit_input(
    endpoint: String,
    current_user_id: String,
    message_type: String,
    slot: String,
    message: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let current_user_id = require_text(
        current_user_id,
        "VrchatToolsInviteMessageEdit requires currentUserId.",
    )?;
    let message_type = require_text(
        message_type,
        "VrchatToolsInviteMessageEdit requires messageType.",
    )?;
    let slot = require_text(slot, "VrchatToolsInviteMessageEdit requires slot.")?;
    Ok((
        slot.clone(),
        api_input(
            endpoint,
            "PUT",
            format!(
                "message/{}/{}/{}",
                encode_path_segment(&current_user_id),
                encode_path_segment(&message_type),
                encode_path_segment(&slot)
            ),
            Some(json!({ "message": message })),
        ),
    ))
}
