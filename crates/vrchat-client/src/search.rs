use std::collections::HashMap;

use serde_json::Value;

use crate::http_api::{
    encode_path_segment, get_input, normalize_text, require_text, HttpApiError, HttpApiRequestInput,
};

pub fn search_config_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "config", params)
}

pub fn search_worlds_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
    option: Option<String>,
) -> HttpApiRequestInput {
    let option = option.map(normalize_text).filter(|value| !value.is_empty());
    let path = match option {
        Some(value) => format!("worlds/{}", encode_path_segment(&value)),
        None => "worlds".into(),
    };
    get_input(endpoint, path, params)
}

pub fn search_users_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "users", params)
}

pub fn search_groups_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "groups", params)
}

pub fn search_groups_strict_get_input(
    endpoint: String,
    params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    get_input(endpoint, "groups/strictsearch", params)
}

pub fn search_instance_short_name_get_input(
    endpoint: String,
    short_name: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let short_name = require_text(
        short_name,
        "VrchatSearchInstanceShortNameGet requires shortName.",
    )?;
    Ok((
        short_name.clone(),
        get_input(
            endpoint,
            format!("instances/s/{}", encode_path_segment(&short_name)),
            HashMap::new(),
        ),
    ))
}
