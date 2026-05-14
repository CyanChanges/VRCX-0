use std::collections::HashMap;

use serde_json::{json, Value};

use crate::http_api::{
    api_input_skip_empty_query_string as api_input, encode_path_segment,
    get_input_skip_empty_query_string as get_input, object_body, require_text, HttpApiError,
    HttpApiRequestInput,
};

pub fn instance_get_input(
    endpoint: String,
    world_id: String,
    instance_id: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatInstanceGet requires worldId.")?;
    let instance_id = require_text(instance_id, "VrchatInstanceGet requires instanceId.")?;
    Ok((
        world_id.clone(),
        instance_id.clone(),
        get_input(
            endpoint,
            format!(
                "instances/{}:{}",
                encode_path_segment(&world_id),
                encode_path_segment(&instance_id)
            ),
            HashMap::new(),
        ),
    ))
}

pub fn instance_short_name_get_input(
    endpoint: String,
    world_id: String,
    instance_id: String,
    short_name: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatInstanceShortNameGet requires worldId.")?;
    let instance_id = require_text(
        instance_id,
        "VrchatInstanceShortNameGet requires instanceId.",
    )?;
    let mut params = HashMap::new();
    if !short_name.is_empty() {
        params.insert("shortName".to_string(), Value::String(short_name));
    }
    Ok((
        world_id.clone(),
        instance_id.clone(),
        get_input(
            endpoint,
            format!(
                "instances/{}:{}/shortName",
                encode_path_segment(&world_id),
                encode_path_segment(&instance_id)
            ),
            params,
        ),
    ))
}

pub fn instance_create_input(endpoint: String, params: Option<Value>) -> HttpApiRequestInput {
    api_input(endpoint, "POST", "instances", object_body(params))
}

pub fn instance_self_invite_input(
    endpoint: String,
    world_id: String,
    instance_id: String,
    short_name: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let world_id = require_text(world_id, "VrchatInstanceSelfInvite requires worldId.")?;
    let instance_id = require_text(instance_id, "VrchatInstanceSelfInvite requires instanceId.")?;
    let body = if short_name.is_empty() {
        json!({})
    } else {
        json!({ "shortName": short_name })
    };
    Ok((
        world_id.clone(),
        instance_id.clone(),
        api_input(
            endpoint,
            "POST",
            format!(
                "invite/myself/to/{}:{}",
                encode_path_segment(&world_id),
                encode_path_segment(&instance_id)
            ),
            body,
        ),
    ))
}

pub fn instance_close_input(
    endpoint: String,
    location: String,
    hard_close: bool,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let location = require_text(location, "VrchatInstanceClose requires location.")?;
    Ok((
        location.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("instances/{location}"),
            json!({ "hardClose": hard_close }),
        ),
    ))
}
