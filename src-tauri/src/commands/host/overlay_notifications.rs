#![allow(non_snake_case)]

use std::time::Duration;

use serde_json::json;
use tauri::State;
use vrcx_0_vrchat_client::web_client::WebExecuteRequest;

use crate::error::AppError;
use crate::state::AppState;

const WEBHOOK_TEST_TIMEOUT: Duration = Duration::from_secs(10);

#[tauri::command]
#[specta::specta]
pub async fn app__webhook_send_test(
    state: State<'_, AppState>,
    url: String,
    format: String,
) -> Result<i32, AppError> {
    let url = url.trim();
    if url.is_empty() {
        return Err(AppError::Custom("Webhook URL is required.".into()));
    }
    let payload = if format.trim() == "discord" {
        json!({
            "content": null,
            "embeds": [{
                "title": "VRCX-0 webhook test",
                "description": "Webhook delivery is configured.",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            }]
        })
    } else {
        json!({
            "version": 1,
            "event": "test",
            "category": "systemSafety",
            "title": "VRCX-0 webhook test",
            "message": "Webhook delivery is configured.",
            "user": {
                "id": "",
                "displayName": "VRCX-0",
            },
            "location": "",
            "worldName": "",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })
    };
    let mut request = WebExecuteRequest::new(url.to_string(), "POST".into());
    request
        .headers
        .push(("Content-Type".into(), "application/json".into()));
    request.body = Some(serde_json::to_string(&payload)?);

    let (status, data) = tokio::time::timeout(WEBHOOK_TEST_TIMEOUT, state.web.execute(request))
        .await
        .map_err(|_| AppError::Custom("Webhook test timed out.".into()))??;
    if status == -1 {
        return Err(AppError::Custom(data));
    }
    Ok(status)
}
