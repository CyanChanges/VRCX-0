use serde_json::Value;
use vrcx_0_persistence::DatabaseService;

use crate::diagnostics::RuntimeDiagnostics;
use crate::sync::RuntimeSyncEngine;
use crate::web_client::WebClient;
use crate::Result;

pub type VrchatApiRequest = vrcx_0_vrchat_client::http_api::HttpApiRequestInput;
pub type VrchatApiResponse = vrcx_0_vrchat_client::http_api::HttpApiExecuteResponse;
pub type VrchatScope = vrcx_0_vrchat_client::http_api::ApiScope;

pub mod auth {
    pub use vrcx_0_vrchat_client::auth::*;
}

pub mod avatars {
    pub use vrcx_0_vrchat_client::avatars::*;
}

pub mod favorites {
    pub use vrcx_0_vrchat_client::favorites::*;
}

pub mod friends {
    pub use vrcx_0_vrchat_client::friends::*;
}

pub mod groups {
    pub use vrcx_0_vrchat_client::groups::*;
}

pub mod instances {
    pub use vrcx_0_vrchat_client::instances::*;
}

pub mod media {
    pub use vrcx_0_vrchat_client::media::*;
}

pub mod notifications {
    pub use vrcx_0_vrchat_client::notifications::*;
}

pub mod search {
    pub use vrcx_0_vrchat_client::search::*;
}

pub mod tools {
    pub use vrcx_0_vrchat_client::tools::*;
}

pub mod users {
    pub use vrcx_0_vrchat_client::users::*;
}

pub mod worlds {
    pub use vrcx_0_vrchat_client::worlds::*;
}

pub use vrcx_0_vrchat_client::http_api::{normalize_text, require_text};

pub async fn execute_api_command(
    web: &WebClient,
    db: &DatabaseService,
    diagnostics: &RuntimeDiagnostics,
    sync: &RuntimeSyncEngine,
    command: &str,
    input: VrchatApiRequest,
    scope: VrchatScope,
) -> Result<VrchatApiResponse> {
    diagnostics.record_command(command, "running", "HTTP API request dispatched.");
    let result = web.execute_api(input, scope, db).await;
    match &result {
        Ok(response) => {
            let policy_class = response
                .raw
                .get("policy")
                .and_then(|policy| policy.get("class"))
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            diagnostics.record_command(
                command,
                "ok",
                format!("status={}, class={policy_class}", response.status),
            );
            sync.record(
                "api",
                "ready",
                format!("{command} completed with status {}.", response.status),
                0,
            );
        }
        Err(error) => {
            diagnostics.record_command(command, "error", error.to_string());
            sync.record_failure("api", error.to_string());
        }
    }
    result
}
