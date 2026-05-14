use std::collections::HashMap;

use serde_json::{json, Value};

use crate::http_api::{
    api_input, encode_path_segment, get_input, object_body, require_text, HttpApiError,
    HttpApiRequestInput,
};

pub fn world_get_input(
    endpoint: String,
    world_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatWorldGet requires worldId.")?;
    Ok((
        world_id.clone(),
        get_input(
            endpoint,
            format!("worlds/{}", encode_path_segment(&world_id)),
            HashMap::new(),
        ),
    ))
}

pub fn world_list_by_user_get_input(
    endpoint: String,
    user_id: String,
    n: i64,
    offset: i64,
    sort: String,
    order: String,
    release_status: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatWorldListByUserGet requires userId.")?;
    Ok((
        user_id.clone(),
        get_input(
            endpoint,
            "worlds",
            HashMap::from([
                ("n".to_string(), json!(n)),
                ("offset".to_string(), json!(offset)),
                ("sort".to_string(), Value::String(sort)),
                ("order".to_string(), Value::String(order)),
                ("userId".to_string(), Value::String(user_id)),
                ("releaseStatus".to_string(), Value::String(release_status)),
            ]),
        ),
    ))
}

pub fn world_persistent_data_exists_input(
    endpoint: String,
    user_id: String,
    world_id: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatWorldPersistentDataExists requires userId.")?;
    let world_id = require_text(
        world_id,
        "VrchatWorldPersistentDataExists requires worldId.",
    )?;
    Ok((
        user_id.clone(),
        world_id.clone(),
        get_input(
            endpoint,
            format!(
                "users/{}/{}/persist/exists",
                encode_path_segment(&user_id),
                encode_path_segment(&world_id)
            ),
            HashMap::new(),
        ),
    ))
}

pub fn world_save_input(
    endpoint: String,
    world_id: String,
    params: Option<Value>,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatWorldSave requires worldId.")?;
    Ok((
        world_id.clone(),
        api_input(
            endpoint,
            "PUT",
            format!("worlds/{}", encode_path_segment(&world_id)),
            Some(object_body(params)),
        ),
    ))
}

pub fn world_delete_input(
    endpoint: String,
    world_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatWorldDelete requires worldId.")?;
    Ok((
        world_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("worlds/{}", encode_path_segment(&world_id)),
            None,
        ),
    ))
}

pub fn world_publish_input(
    endpoint: String,
    world_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatWorldPublish requires worldId.")?;
    Ok((
        world_id.clone(),
        api_input(
            endpoint,
            "PUT",
            format!("worlds/{}/publish", encode_path_segment(&world_id)),
            Some(json!({ "worldId": world_id })),
        ),
    ))
}

pub fn world_unpublish_input(
    endpoint: String,
    world_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatWorldUnpublish requires worldId.")?;
    Ok((
        world_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("worlds/{}/publish", encode_path_segment(&world_id)),
            None,
        ),
    ))
}

pub fn world_persistent_data_delete_input(
    endpoint: String,
    user_id: String,
    world_id: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let user_id = require_text(user_id, "VrchatWorldPersistentDataDelete requires userId.")?;
    let world_id = require_text(
        world_id,
        "VrchatWorldPersistentDataDelete requires worldId.",
    )?;
    Ok((
        user_id.clone(),
        world_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!(
                "users/{}/{}/persist",
                encode_path_segment(&user_id),
                encode_path_segment(&world_id)
            ),
            None,
        ),
    ))
}
