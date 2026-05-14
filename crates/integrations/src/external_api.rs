use std::collections::HashMap;
use std::net::IpAddr;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use url::Url;

const STATUS_API_ORIGIN: &str = "https://status.vrchat.com";
const YOUTUBE_API_ORIGIN: &str = "https://www.googleapis.com";
const GITHUB_API_ORIGIN: &str = "https://api.github.com";

#[derive(Debug, thiserror::Error)]
pub enum ExternalApiError {
    #[error("{0}")]
    Custom(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExternalApiScope {
    AvatarSearch,
    Translation,
    Youtube,
    VrcStatus,
    UpdateRelease,
    Image,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalApiResponsePolicy {
    pub class: String,
    pub endpoint_scope: String,
    pub retryable: bool,
    pub rate_limited: bool,
    pub session_recovery_required: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalHttpRequestInput {
    pub url: Option<String>,
    pub path: Option<String>,
    pub method: Option<String>,
    pub params: Option<HashMap<String, Value>>,
    pub query_params: Option<HashMap<String, Value>>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<Value>,
    pub json_body: Option<bool>,
    pub skip_empty_query_string: Option<bool>,
}

#[derive(Clone, Debug, Default)]
pub struct ExternalApiPolicy {
    allowed_origins: Vec<String>,
}

impl ExternalApiPolicy {
    pub fn with_allowed_origins<I, S>(origins: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let mut allowed_origins = origins
            .into_iter()
            .filter_map(|origin| normalize_origin(origin.as_ref()))
            .collect::<Vec<_>>();
        allowed_origins.sort();
        allowed_origins.dedup();
        Self { allowed_origins }
    }

    fn allows_origin(&self, origin: &str) -> bool {
        self.allowed_origins.iter().any(|allowed| allowed == origin)
    }
}

#[derive(Debug, Serialize)]
pub struct ExternalApiExecuteResponse {
    pub status: i32,
    pub data: String,
    pub raw: Value,
}

pub struct ExternalWebExecuteRequest {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

impl ExternalWebExecuteRequest {
    pub fn new(url: impl Into<String>, method: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            method: method.into(),
            headers: Vec::new(),
            body: None,
        }
    }
}

pub fn youtube_video_metadata_get_input(
    youtube_id: &str,
    api_key: &str,
) -> ExternalHttpRequestInput {
    let mut request = ExternalHttpRequestInput {
        url: Some("https://www.googleapis.com/youtube/v3/videos".into()),
        method: Some("GET".into()),
        query_params: Some(HashMap::from([
            ("id".to_string(), Value::String(youtube_id.to_string())),
            (
                "part".to_string(),
                Value::String("snippet,contentDetails".to_string()),
            ),
            ("key".to_string(), Value::String(api_key.to_string())),
        ])),
        ..Default::default()
    };
    request.params = request.query_params.clone();
    request
}

pub fn build_web_execute_request(
    input: ExternalHttpRequestInput,
    scope: ExternalApiScope,
) -> Result<ExternalWebExecuteRequest, ExternalApiError> {
    build_web_execute_request_with_policy(input, scope, &ExternalApiPolicy::default())
}

pub fn build_web_execute_request_with_policy(
    input: ExternalHttpRequestInput,
    scope: ExternalApiScope,
    policy: &ExternalApiPolicy,
) -> Result<ExternalWebExecuteRequest, ExternalApiError> {
    let method = input
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let mut request =
        ExternalWebExecuteRequest::new(build_request_url(&input, scope, policy)?, method.clone());

    let headers = sanitize_headers(input.headers.as_ref(), scope)?;
    request.headers = headers.into_iter().collect();

    if let Some(body) = request_body_text(&input, &method)? {
        request.body = Some(body);
    }

    Ok(request)
}

pub fn execute_response(
    status: i32,
    data: String,
    scope: ExternalApiScope,
) -> ExternalApiExecuteResponse {
    let policy = classify_response(status, scope);
    ExternalApiExecuteResponse {
        status,
        data: data.clone(),
        raw: json!({
            "status": status,
            "data": data,
            "policy": policy,
        }),
    }
}

fn classify_response(status: i32, scope: ExternalApiScope) -> ExternalApiResponsePolicy {
    let class = match status {
        200..=399 => "ok",
        401 | 403 => "auth",
        429 => "rateLimited",
        400..=499 => "clientError",
        500..=599 => "serverError",
        _ => "unknown",
    };
    ExternalApiResponsePolicy {
        class: class.to_string(),
        endpoint_scope: scope_name(scope).to_string(),
        retryable: matches!(status, 408 | 409 | 425 | 429 | 500..=599),
        rate_limited: status == 429,
        session_recovery_required: false,
    }
}

fn scope_name(scope: ExternalApiScope) -> &'static str {
    match scope {
        ExternalApiScope::AvatarSearch => "externalAvatarSearch",
        ExternalApiScope::Translation => "externalTranslation",
        ExternalApiScope::Youtube => "externalYoutube",
        ExternalApiScope::VrcStatus => "externalVrcStatus",
        ExternalApiScope::UpdateRelease => "externalUpdateRelease",
        ExternalApiScope::Image => "externalImage",
    }
}

fn build_request_url(
    input: &ExternalHttpRequestInput,
    scope: ExternalApiScope,
    policy: &ExternalApiPolicy,
) -> Result<String, ExternalApiError> {
    let url = input
        .url
        .as_deref()
        .or(input.path.as_deref())
        .map(str::trim)
        .filter(|url| !url.is_empty())
        .ok_or_else(|| ExternalApiError::Custom("external API requests require url".into()))?;
    let mut url = parse_http_url(url)?;
    if !external_url_allowed(&url, scope, policy) {
        return Err(ExternalApiError::Custom(
            "external API URL is not allowed for this command".into(),
        ));
    }

    let query_params = input.query_params.as_ref().or(input.params.as_ref());
    if let Some(params) = query_params {
        append_query_params(
            &mut url,
            params,
            input.skip_empty_query_string.unwrap_or(false),
        );
    }
    Ok(url.to_string())
}

fn parse_http_url(url: &str) -> Result<Url, ExternalApiError> {
    let url = Url::parse(url)
        .map_err(|error| ExternalApiError::Custom(format!("bad API URL: {error}")))?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err(ExternalApiError::Custom(
            "unsupported API URL scheme".into(),
        ));
    }
    Ok(url)
}

fn external_url_allowed(url: &Url, scope: ExternalApiScope, policy: &ExternalApiPolicy) -> bool {
    let origin = url_origin(url);
    match scope {
        ExternalApiScope::AvatarSearch => url.scheme() == "https" && policy.allows_origin(&origin),
        ExternalApiScope::Translation => {
            origin == "https://translation.googleapis.com" || policy.allows_origin(&origin)
        }
        ExternalApiScope::Image => {
            url.scheme() == "https"
                && (is_vrchat_media_origin(url) || policy.allows_origin(&origin))
        }
        ExternalApiScope::Youtube => {
            origin == YOUTUBE_API_ORIGIN && url.path().starts_with("/youtube/v3/videos")
        }
        ExternalApiScope::VrcStatus => origin == STATUS_API_ORIGIN,
        ExternalApiScope::UpdateRelease => {
            origin == GITHUB_API_ORIGIN
                && url.path().starts_with("/repos/")
                && url.path().ends_with("/releases")
        }
    }
}

pub fn request_origin(value: &str) -> Option<String> {
    Url::parse(value)
        .ok()
        .and_then(|url| normalize_url_origin(&url))
}

fn normalize_origin(value: &str) -> Option<String> {
    Url::parse(value.trim())
        .ok()
        .and_then(|url| normalize_url_origin(&url))
}

fn normalize_url_origin(url: &Url) -> Option<String> {
    if url.scheme() != "https" || !is_public_host(url) {
        return None;
    }
    Some(url_origin(url))
}

fn is_public_host(url: &Url) -> bool {
    let Some(host) = url.host_str().map(|host| host.trim().to_ascii_lowercase()) else {
        return false;
    };
    if host.is_empty() || host == "localhost" || host.ends_with(".localhost") {
        return false;
    }
    let ip_host = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(&host);
    if let Ok(ip) = ip_host.parse::<IpAddr>() {
        return is_public_ip(ip);
    }
    true
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.octets()[0] == 0
                || ip.octets()[0] >= 224)
        }
        IpAddr::V6(ip) => {
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.is_unique_local()
                || ip.is_unicast_link_local())
        }
    }
}

fn is_vrchat_media_origin(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str().map(|host| host.to_ascii_lowercase()) else {
        return false;
    };
    host == "vrchat.com"
        || host.ends_with(".vrchat.com")
        || host == "vrchat.cloud"
        || host.ends_with(".vrchat.cloud")
}

fn sanitize_headers(
    headers: Option<&HashMap<String, String>>,
    scope: ExternalApiScope,
) -> Result<HashMap<String, String>, ExternalApiError> {
    let Some(headers) = headers else {
        return Ok(HashMap::new());
    };
    let mut sanitized = HashMap::new();
    for (name, value) in headers {
        let normalized = name.trim().to_ascii_lowercase();
        if matches!(
            normalized.as_str(),
            "host"
                | "cookie"
                | "proxy-authorization"
                | "connection"
                | "content-length"
                | "transfer-encoding"
        ) {
            return Err(ExternalApiError::Custom(format!(
                "external API header is not allowed: {name}"
            )));
        }
        if normalized == "authorization" && scope != ExternalApiScope::Translation {
            return Err(ExternalApiError::Custom(format!(
                "external API header is not allowed: {name}"
            )));
        }
        if normalized == "authorization"
            && !value
                .trim_start()
                .to_ascii_lowercase()
                .starts_with("bearer ")
        {
            return Err(ExternalApiError::Custom(
                "translation authorization must use Bearer token syntax.".into(),
            ));
        }
        if name.chars().any(|ch| ch.is_control())
            || value.chars().any(|ch| matches!(ch, '\r' | '\n'))
        {
            return Err(ExternalApiError::Custom(format!(
                "external API header contains invalid characters: {name}"
            )));
        }
        if !name.trim().is_empty() {
            sanitized.insert(name.trim().to_string(), value.to_string());
        }
    }
    Ok(sanitized)
}

fn request_body_text(
    input: &ExternalHttpRequestInput,
    method: &str,
) -> Result<Option<String>, ExternalApiError> {
    if method == "GET" {
        return Ok(None);
    }

    let json_body = input.json_body.unwrap_or(true);
    if !json_body {
        return Ok(input.body.as_ref().and_then(|value| {
            value
                .as_str()
                .map(ToString::to_string)
                .or_else(|| (!value.is_null()).then(|| value.to_string()))
        }));
    }

    let body = input.body.as_ref().unwrap_or(&Value::Null);
    serde_json::to_string(&normalize_json_body(body))
        .map(Some)
        .map_err(|error| ExternalApiError::Custom(format!("serialize API body: {error}")))
}

fn normalize_json_body(value: &Value) -> Value {
    if value.is_object() {
        value.clone()
    } else {
        json!({})
    }
}

fn append_query_params(url: &mut Url, params: &HashMap<String, Value>, skip_empty_string: bool) {
    for (key, value) in params {
        if let Value::Array(values) = value {
            for item in values {
                for text in value_as_query_strings(item, skip_empty_string) {
                    url.query_pairs_mut().append_pair(key, &text);
                }
            }
            continue;
        }

        let values = value_as_query_strings(value, skip_empty_string);
        if values.len() == 1 {
            url.query_pairs_mut().append_pair(key, &values[0]);
        }
    }
}

fn value_as_query_strings(value: &Value, skip_empty_string: bool) -> Vec<String> {
    match value {
        Value::Null => Vec::new(),
        Value::String(value) => {
            if skip_empty_string && value.is_empty() {
                Vec::new()
            } else {
                vec![value.to_string()]
            }
        }
        Value::Bool(value) => vec![value.to_string()],
        Value::Number(value) => vec![value.to_string()],
        other => vec![other.to_string()],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_provider_origins_require_public_https() {
        assert_eq!(
            request_origin("https://example.com/api"),
            Some("https://example.com".into())
        );
        assert_eq!(request_origin("http://example.com/api"), None);
        assert_eq!(request_origin("https://localhost/api"), None);
        assert_eq!(request_origin("https://127.0.0.1/api"), None);
        assert_eq!(request_origin("https://10.0.0.5/api"), None);
        assert_eq!(request_origin("https://[::1]/api"), None);
    }

    #[test]
    fn external_policy_rejects_non_https_configured_origins() {
        let policy = ExternalApiPolicy::with_allowed_origins([
            "http://example.com",
            "https://127.0.0.1",
            "https://example.com",
        ]);
        let request = ExternalHttpRequestInput {
            url: Some("https://example.com/search".into()),
            ..Default::default()
        };
        assert!(build_web_execute_request_with_policy(
            request,
            ExternalApiScope::AvatarSearch,
            &policy
        )
        .is_ok());

        let request = ExternalHttpRequestInput {
            url: Some("http://example.com/search".into()),
            ..Default::default()
        };
        assert!(build_web_execute_request_with_policy(
            request,
            ExternalApiScope::AvatarSearch,
            &policy
        )
        .is_err());
    }

    #[test]
    fn translation_scope_allows_bearer_authorization_header() {
        let policy = ExternalApiPolicy::with_allowed_origins(["https://api.openai.com"]);
        let request = ExternalHttpRequestInput {
            url: Some("https://api.openai.com/v1/chat/completions".into()),
            method: Some("POST".into()),
            headers: Some(HashMap::from([(
                "Authorization".to_string(),
                "Bearer test-token".to_string(),
            )])),
            body: Some(json!({ "messages": [] })),
            ..Default::default()
        };

        let request =
            build_web_execute_request_with_policy(request, ExternalApiScope::Translation, &policy)
                .expect("translation authorization header");

        assert!(request
            .headers
            .iter()
            .any(|(name, value)| name == "Authorization" && value == "Bearer test-token"));
    }

    #[test]
    fn non_translation_scopes_reject_authorization_header() {
        let policy = ExternalApiPolicy::with_allowed_origins(["https://example.com"]);
        let request = ExternalHttpRequestInput {
            url: Some("https://example.com/search".into()),
            headers: Some(HashMap::from([(
                "Authorization".to_string(),
                "Bearer test-token".to_string(),
            )])),
            ..Default::default()
        };

        assert!(build_web_execute_request_with_policy(
            request,
            ExternalApiScope::AvatarSearch,
            &policy,
        )
        .is_err());
    }
}

fn url_origin(url: &Url) -> String {
    match url.port() {
        Some(port) => format!(
            "{}://{}:{}",
            url.scheme(),
            url.host_str().unwrap_or(""),
            port
        ),
        None => format!("{}://{}", url.scheme(), url.host_str().unwrap_or("")),
    }
}
