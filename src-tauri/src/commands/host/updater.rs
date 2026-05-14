#![allow(non_snake_case)]

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::error::AppError;
use vrcx_0_host::host_capabilities::{current_arch, current_host_capabilities, current_platform};
use vrcx_0_host::proxy::normalize_proxy_url;

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum TauriDownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriUpdateMetadata {
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

impl From<&Update> for TauriUpdateMetadata {
    fn from(update: &Update) -> Self {
        Self {
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            date: update
                .raw_json
                .get("pub_date")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string),
            body: update.body.clone(),
            raw_json: update.raw_json.clone(),
        }
    }
}

fn updater_error(context: &str, error: impl std::fmt::Display) -> AppError {
    AppError::Custom(format!("{context}: {error}"))
}

fn expected_updater_target() -> Result<String, AppError> {
    let platform = current_platform();
    let arch = current_arch();
    let target = match platform {
        "windows" if arch == "x86_64" => "windows-x86_64-stable".to_string(),
        "macos" if arch == "aarch64" => "macos-aarch64-stable".to_string(),
        "macos" if arch == "x86_64" => "macos-x86_64-stable".to_string(),
        "linux" if arch == "x86_64" => {
            let kind = current_host_capabilities().linux_package_kind;
            let kind = match kind.as_str() {
                "deb" | "rpm" => kind,
                _ => "appimage".to_string(),
            };
            format!("linux-x86_64-{kind}-stable")
        }
        _ => {
            return Err(AppError::Custom(format!(
                "Updates are not installable on {platform}/{arch}."
            )))
        }
    };
    Ok(target)
}

fn validate_update_request(
    manifest_url: &str,
    target: &str,
    allow_downgrades: bool,
) -> Result<Url, AppError> {
    if allow_downgrades {
        return Err(AppError::Custom(
            "Stable updater commands do not allow downgrades.".into(),
        ));
    }

    let expected_target = expected_updater_target()?;
    if target != expected_target {
        return Err(AppError::Custom(format!(
            "Updater target mismatch: expected {expected_target}, got {target}."
        )));
    }

    let endpoint: Url = manifest_url
        .parse()
        .map_err(|error| updater_error("Invalid update manifest URL", error))?;
    if endpoint.scheme() != "https"
        || endpoint.host_str() != Some("github.com")
        || !matches!(
            endpoint.path(),
            path if path.contains("/releases/download/")
                || path.contains("/releases/latest/download/")
        )
        || !matches!(
            endpoint.path().rsplit('/').next(),
            Some("latest_windows.json" | "latest_linux_and_macos.json")
        )
    {
        return Err(AppError::Custom(
            "Update manifest must be a GitHub release asset URL.".into(),
        ));
    }
    Ok(endpoint)
}

async fn find_update(
    app_handle: &AppHandle,
    manifest_url: String,
    target: String,
    allow_downgrades: bool,
    proxy: Option<String>,
) -> Result<Option<Update>, AppError> {
    let endpoint = validate_update_request(&manifest_url, &target, allow_downgrades)?;
    let mut builder = app_handle
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|error| updater_error("Failed to configure update endpoint", error))?
        .target(target);

    if let Some(proxy_url) = proxy
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        if let Some(proxy_url) = normalize_proxy_url(&proxy_url)
            .map_err(|error| updater_error("Invalid update proxy URL", error))?
        {
            let proxy: Url = proxy_url
                .parse()
                .map_err(|error| updater_error("Invalid update proxy URL", error))?;
            builder = builder.proxy(proxy);
        }
    }

    let updater = builder
        .build()
        .map_err(|error| updater_error("Failed to initialize updater", error))?;
    updater
        .check()
        .await
        .map_err(|error| updater_error("Failed to check for updates", error))
}

#[tauri::command]
pub async fn app__check_tauri_update(
    app_handle: AppHandle,
    manifest_url: String,
    target: String,
    allow_downgrades: bool,
    proxy: Option<String>,
) -> Result<Option<TauriUpdateMetadata>, AppError> {
    Ok(
        find_update(&app_handle, manifest_url, target, allow_downgrades, proxy)
            .await?
            .as_ref()
            .map(TauriUpdateMetadata::from),
    )
}

#[tauri::command]
pub async fn app__download_and_install_tauri_update(
    app_handle: AppHandle,
    manifest_url: String,
    target: String,
    allow_downgrades: bool,
    proxy: Option<String>,
    on_event: Channel<TauriDownloadEvent>,
) -> Result<Option<TauriUpdateMetadata>, AppError> {
    let Some(update) =
        find_update(&app_handle, manifest_url, target, allow_downgrades, proxy).await?
    else {
        return Ok(None);
    };

    let metadata = TauriUpdateMetadata::from(&update);
    let mut first_chunk = true;
    update
        .download_and_install(
            |chunk_length, content_length| {
                if first_chunk {
                    first_chunk = false;
                    let _ = on_event.send(TauriDownloadEvent::Started { content_length });
                }
                let _ = on_event.send(TauriDownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(TauriDownloadEvent::Finished);
            },
        )
        .await
        .map_err(|error| updater_error("Failed to download and install update", error))?;

    Ok(Some(metadata))
}
