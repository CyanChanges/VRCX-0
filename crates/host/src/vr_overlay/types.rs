use serde::{Deserialize, Serialize};
use vrcx_0_vr_overlay::{OverlaySize, OverlaySurfaceId};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BackendStartError {
    pub message: String,
    pub permanent: bool,
}

impl BackendStartError {
    pub fn permanent(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            permanent: true,
        }
    }

    pub fn transient(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            permanent: false,
        }
    }
}

impl std::fmt::Display for BackendStartError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OverlaySurfaceConfig {
    pub surface_id: OverlaySurfaceId,
    pub size: OverlaySize,
    pub physical_width_meters: f32,
    pub placement: OverlayPlacement,
    #[serde(default)]
    pub activation_button: OverlayActivationButton,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OverlayPlacement {
    TrackedDeviceRelative { device_hint: String },
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OverlayActivationButton {
    #[default]
    Grip,
    Menu,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct VrDeviceSnapshot {
    pub label: String,
    pub serial: Option<String>,
    pub status: VrDeviceStatus,
    pub battery_percent: Option<u8>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VrDeviceStatus {
    Normal,
    LowBattery,
    CriticalBattery,
    Charging,
    TrackingWarning,
    Disconnected,
}
