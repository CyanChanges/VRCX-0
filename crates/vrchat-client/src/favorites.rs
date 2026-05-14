use std::collections::HashMap;

use serde_json::{json, Value};

use crate::http_api::{
    api_input, encode_path_segment, get_input, normalize_text, require_text, HttpApiError,
    HttpApiRequestInput,
};

pub fn favorite_limits_get_input(endpoint: String) -> HttpApiRequestInput {
    get_input(endpoint, "auth/user/favoritelimits", HashMap::new())
}

pub fn favorites_get_input(endpoint: String, n: i64, offset: i64) -> HttpApiRequestInput {
    get_input(
        endpoint,
        "favorites",
        HashMap::from([
            ("n".to_string(), json!(n)),
            ("offset".to_string(), json!(offset)),
        ]),
    )
}

pub fn favorite_worlds_get_input(
    endpoint: String,
    n: i64,
    offset: i64,
    owner_id: String,
    user_id: String,
    tag: String,
) -> HttpApiRequestInput {
    let owner_id = normalize_text(owner_id);
    let user_id = normalize_text(user_id);
    let tag = normalize_text(tag);
    let mut params = HashMap::from([
        ("n".to_string(), json!(n)),
        ("offset".to_string(), json!(offset)),
    ]);
    if !owner_id.is_empty() {
        params.insert("ownerId".to_string(), Value::String(owner_id));
    }
    if !user_id.is_empty() {
        params.insert("userId".to_string(), Value::String(user_id));
    }
    if !tag.is_empty() {
        params.insert("tag".to_string(), Value::String(tag));
    }
    get_input(endpoint, "worlds/favorites", params)
}

pub fn favorite_avatars_get_input(
    endpoint: String,
    n: i64,
    offset: i64,
    tag: String,
) -> HttpApiRequestInput {
    let tag = normalize_text(tag);
    let mut params = HashMap::from([
        ("n".to_string(), json!(n)),
        ("offset".to_string(), json!(offset)),
    ]);
    if !tag.is_empty() {
        params.insert("tag".to_string(), Value::String(tag));
    }
    get_input(endpoint, "avatars/favorites", params)
}

pub fn favorite_groups_get_input(
    endpoint: String,
    n: i64,
    offset: i64,
    owner_id: String,
) -> HttpApiRequestInput {
    let owner_id = normalize_text(owner_id);
    let mut params = HashMap::from([
        ("n".to_string(), json!(n)),
        ("offset".to_string(), json!(offset)),
    ]);
    if !owner_id.is_empty() {
        params.insert("ownerId".to_string(), Value::String(owner_id));
    }
    get_input(endpoint, "favorite/groups", params)
}

pub fn favorite_add_input(
    endpoint: String,
    type_name: String,
    favorite_id: String,
    tags: String,
) -> Result<(String, String, HttpApiRequestInput), HttpApiError> {
    let type_name = require_text(type_name, "VrchatFavoriteAdd requires type.")?;
    let favorite_id = require_text(favorite_id, "VrchatFavoriteAdd requires favoriteId.")?;
    let tags = require_text(tags, "VrchatFavoriteAdd requires tags.")?;
    Ok((
        type_name.clone(),
        favorite_id.clone(),
        api_input(
            endpoint,
            "POST",
            "favorites",
            Some(json!({
                "type": type_name,
                "favoriteId": favorite_id,
                "tags": tags,
            })),
        ),
    ))
}

pub fn favorite_delete_input(
    endpoint: String,
    object_id: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let object_id = require_text(object_id, "VrchatFavoriteDelete requires objectId.")?;
    Ok((
        object_id.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!("favorites/{}", encode_path_segment(&object_id)),
            None,
        ),
    ))
}

pub fn favorite_group_save_input(
    endpoint: String,
    owner_id: String,
    type_name: String,
    group: String,
    display_name: Option<String>,
    visibility: Option<String>,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let owner_id = require_text(owner_id, "VrchatFavoriteGroupSave requires ownerId.")?;
    let type_name = require_text(type_name, "VrchatFavoriteGroupSave requires type.")?;
    let group = require_text(group, "VrchatFavoriteGroupSave requires group.")?;
    let mut body = json!({
        "type": type_name,
        "group": group,
    });
    if let Some(display_name) = display_name {
        body["displayName"] = Value::String(display_name);
    }
    if let Some(visibility) = visibility {
        body["visibility"] = Value::String(visibility);
    }
    Ok((
        group.clone(),
        api_input(
            endpoint,
            "PUT",
            format!(
                "favorite/group/{}/{}/{}",
                encode_path_segment(&type_name),
                encode_path_segment(&group),
                encode_path_segment(&owner_id)
            ),
            Some(body),
        ),
    ))
}

pub fn favorite_group_clear_input(
    endpoint: String,
    owner_id: String,
    type_name: String,
    group: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let owner_id = require_text(owner_id, "VrchatFavoriteGroupClear requires ownerId.")?;
    let type_name = require_text(type_name, "VrchatFavoriteGroupClear requires type.")?;
    let group = require_text(group, "VrchatFavoriteGroupClear requires group.")?;
    Ok((
        group.clone(),
        api_input(
            endpoint,
            "DELETE",
            format!(
                "favorite/group/{}/{}/{}",
                encode_path_segment(&type_name),
                encode_path_segment(&group),
                encode_path_segment(&owner_id)
            ),
            None,
        ),
    ))
}
