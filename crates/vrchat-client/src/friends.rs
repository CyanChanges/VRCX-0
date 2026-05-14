use std::collections::HashMap;

use serde_json::{json, Value};

use crate::http_api::{
    api_input, encode_path_segment, get_input, normalize_text, require_text, HttpApiError,
    HttpApiRequestInput,
};

pub fn friends_get_input(
    endpoint: String,
    offline: bool,
    n: i64,
    offset: i64,
) -> HttpApiRequestInput {
    get_input(
        endpoint,
        "auth/user/friends",
        HashMap::from([
            ("offline".to_string(), Value::Bool(offline)),
            ("n".to_string(), json!(n)),
            ("offset".to_string(), json!(offset)),
        ]),
    )
}

pub fn friend_status_get_input(
    endpoint: String,
    user_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatFriendStatusGet requires userId.")?;
    Ok((
        user_id.clone(),
        get_input(
            endpoint,
            format!("user/{}/friendStatus", encode_path_segment(&user_id)),
            HashMap::new(),
        ),
    ))
}

pub fn friend_delete_input(
    endpoint: String,
    user_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatFriendDelete requires userId.")?;
    Ok((
        user_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("auth/user/friends/{}", encode_path_segment(&user_id)),
            None,
        ),
    ))
}

pub fn friend_request_send_input(
    endpoint: String,
    user_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatFriendRequestSend requires userId.")?;
    Ok((
        user_id.clone(),
        api_input(
            endpoint,
            "POST",
            format!("user/{}/friendRequest", encode_path_segment(&user_id)),
            None,
        ),
    ))
}

pub fn friend_request_cancel_input(
    endpoint: String,
    user_id: String,
    notification_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatFriendRequestCancel requires userId.")?;
    let notification_id = normalize_text(notification_id);
    let body = if notification_id.is_empty() {
        None
    } else {
        Some(json!({ "notificationId": notification_id }))
    };
    Ok((
        user_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("user/{}/friendRequest", encode_path_segment(&user_id)),
            body,
        ),
    ))
}
