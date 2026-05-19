use std::path::Path;

use vrcx_0_application::LogLocationSnapshotScanner;
pub use vrcx_0_application::{GameLogEvent, GameLogEventSink, LogLocationSnapshot, LogWatcher};

#[derive(Default)]
pub struct HostLogLocationSnapshotScanner;

impl LogLocationSnapshotScanner for HostLogLocationSnapshotScanner {
    fn scan_current_location_snapshot(&self, log_dir: &Path) -> Option<LogLocationSnapshot> {
        vrcx_0_host::log_scanner::scan_current_location_snapshot(log_dir)
    }
}
