use super::*;

pub(super) async fn execute_vrchat_json_request(
    deps: &SocialBaselineDeps,
    request: HttpApiRequestInput,
) -> Result<Value> {
    let response = deps
        .web
        .execute_api(request, ApiScope::Vrchat, deps.db.as_ref())
        .await?;

    let json = parse_response_json(&response.data);
    if response.status >= 400 || response_has_error(&json) {
        return Err(Error::Custom(unwrap_error_message(
            &json,
            response.status,
            "VRChat social baseline request failed",
        )));
    }

    Ok(json)
}

fn parse_response_json(data: &str) -> Value {
    serde_json::from_str(data).unwrap_or_else(|_| Value::String(data.to_string()))
}

fn response_has_error(json: &Value) -> bool {
    json.as_object()
        .is_some_and(|object| object.contains_key("error"))
}

fn value_message(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|message| !message.is_empty())
        .map(|message| message.trim_matches('"').to_string())
}

fn unwrap_error_message(json: &Value, status: i32, fallback: &str) -> String {
    if let Some(message) = value_message(Some(json)) {
        return message;
    }

    let object = json.as_object();
    if let Some(message) = value_message(
        object
            .and_then(|record| record.get("error"))
            .and_then(Value::as_object)
            .and_then(|error| error.get("message")),
    ) {
        return message;
    }
    if let Some(message) = value_message(object.and_then(|record| record.get("message"))) {
        return message;
    }

    format!("{fallback} ({status})")
}

pub(super) async fn fetch_paged_array<F>(
    deps: &SocialBaselineDeps,
    page_size: i64,
    max_offset: Option<i64>,
    mut build_request: F,
) -> Result<Vec<Value>>
where
    F: FnMut(i64, i64) -> HttpApiRequestInput,
{
    let mut rows = Vec::new();
    let mut offset = 0;
    loop {
        if max_offset.is_some_and(|max_offset| offset > max_offset) {
            break;
        }
        let json = execute_vrchat_json_request(deps, build_request(page_size, offset)).await?;
        let page = json.as_array().cloned().unwrap_or_default();
        let page_len = page.len();
        rows.extend(page);
        if page_len < page_size as usize {
            break;
        }
        offset += page_size;
    }
    Ok(rows)
}
