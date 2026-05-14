use std::collections::HashMap;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde_json::{json, Value};

use crate::http_api::{normalize_text, require_text, HttpApiError, HttpApiRequestInput};

pub fn encode_path_segment(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

pub fn encode_uri_component(value: &str) -> String {
    let mut output = String::new();
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => output.push(char::from(*byte)),
            _ => output.push_str(&format!("%{byte:02X}")),
        }
    }
    output
}

fn json_headers() -> HashMap<String, String> {
    HashMap::from([(
        "Content-Type".to_string(),
        "application/json;charset=utf-8".to_string(),
    )])
}

pub fn get_input(
    endpoint: String,
    path: impl Into<String>,
    headers: HashMap<String, String>,
    query_params: HashMap<String, Value>,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some("GET".into()),
        path: Some(path.into()),
        headers: (!headers.is_empty()).then_some(headers),
        params: Some(query_params.clone()),
        query_params: Some(query_params),
        ..Default::default()
    }
}

pub fn api_input(
    endpoint: String,
    method: &str,
    path: impl Into<String>,
    body: Value,
) -> HttpApiRequestInput {
    HttpApiRequestInput {
        endpoint: Some(endpoint),
        method: Some(method.into()),
        path: Some(path.into()),
        headers: Some(json_headers()),
        body: Some(body),
        json_body: Some(true),
        ..Default::default()
    }
}

pub fn config_get_input(endpoint: String) -> HttpApiRequestInput {
    get_input(endpoint, "config", HashMap::new(), HashMap::new())
}

pub fn current_user_get_input(endpoint: String) -> HttpApiRequestInput {
    get_input(endpoint, "auth/user", HashMap::new(), HashMap::new())
}

pub fn session_get_input(endpoint: String) -> HttpApiRequestInput {
    get_input(endpoint, "auth", HashMap::new(), HashMap::new())
}

pub fn login_basic_input(
    endpoint: String,
    username: String,
    password: String,
    username_message: &str,
    password_message: &str,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let username = require_text(username, username_message)?;
    let password = require_text(password, password_message)?;
    let credentials = format!(
        "{}:{}",
        encode_uri_component(&username),
        encode_uri_component(&password)
    );
    let authorization = format!("Basic {}", B64.encode(credentials.as_bytes()));
    Ok((
        username.clone(),
        get_input(
            endpoint,
            "auth/user",
            HashMap::from([("Authorization".to_string(), authorization)]),
            HashMap::new(),
        ),
    ))
}

pub fn totp_verify_input(endpoint: String, code: String) -> HttpApiRequestInput {
    api_input(
        endpoint,
        "POST",
        "auth/twofactorauth/totp/verify",
        json!({ "code": normalize_text(code) }),
    )
}

pub fn otp_verify_input(endpoint: String, code: String) -> HttpApiRequestInput {
    let normalized_code = normalize_text(code).replace(char::is_whitespace, "");
    let formatted_code = if normalized_code.len() > 4 && !normalized_code.contains('-') {
        format!("{}-{}", &normalized_code[..4], &normalized_code[4..])
    } else {
        normalized_code
    };
    api_input(
        endpoint,
        "POST",
        "auth/twofactorauth/otp/verify",
        json!({ "code": formatted_code }),
    )
}

pub fn email_otp_verify_input(endpoint: String, code: String) -> HttpApiRequestInput {
    api_input(
        endpoint,
        "POST",
        "auth/twofactorauth/emailotp/verify",
        json!({ "code": normalize_text(code) }),
    )
}

pub fn visits_get_input(endpoint: String) -> HttpApiRequestInput {
    get_input(endpoint, "visits", HashMap::new(), HashMap::new())
}

pub fn file_analysis_get_input(
    endpoint: String,
    file_id: String,
    version: i64,
    variant: String,
) -> Result<(String, HttpApiRequestInput), HttpApiError> {
    let file_id = require_text(file_id, "VrchatAuthFileAnalysisGet requires fileId.")?;
    let variant = require_text(variant, "VrchatAuthFileAnalysisGet requires variant.")?;
    Ok((
        file_id.clone(),
        get_input(
            endpoint,
            format!(
                "analysis/{}/{}/{}",
                encode_path_segment(&file_id),
                version,
                encode_path_segment(&variant)
            ),
            HashMap::new(),
            HashMap::new(),
        ),
    ))
}
