mod host;
mod ingest;
pub(crate) mod instance_media;
pub(crate) mod lifecycle;
mod processor;
mod runtime;
mod runtime_state;
pub(crate) mod screenshot;
pub(crate) mod video;

pub use host::{GameLogHostActions, NoopGameLogHostActions};
pub use ingest::{
    GameLogIngestEngine, GameLogIngestOptions, GameLogIngestOutput, GameLogProcessEvent,
    GameLogSideEffect, ScreenshotInput,
};
pub use runtime::{GameLogRuntime, GameLogRuntimeDeps};
pub use runtime_state::{
    duration_ms, parse_event_time_ms, player_key, world_id_from_location, GameLogProjection,
    GameLogRuntimeState, PlayerState, RuntimeSnapshot,
};
