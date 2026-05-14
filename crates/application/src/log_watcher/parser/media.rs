use super::*;

pub(super) fn parse_api_request(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.starts_with("[API] [") {
        return false;
    }
    if let Some(pos) = line.rfind("] Sending Get request to ") {
        let data = &line[pos + 25..];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::ApiRequest { url: data.into() },
            first_run,
        );
        return true;
    }
    false
}

pub(super) fn parse_avatar_change(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.starts_with("[Behaviour] Switching ") {
        return false;
    }
    if let Some(pos) = line.rfind(" to avatar ") {
        if let Some(start) = line.rfind("[Behaviour] Switching ") {
            let display_name = &line[start + 22..pos];
            let avatar_name = &line[pos + 11..];
            append_event(
                inner,
                fname,
                line,
                GameLogEventKind::AvatarChange {
                    display_name: display_name.into(),
                    avatar_name: avatar_name.into(),
                },
                first_run,
            );
        }
    }
    true
}

pub(super) fn parse_join_blocked(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.contains("] Master is not sending any events! Moving to a new instance.") {
        return false;
    }
    append_event(
        inner,
        fname,
        line,
        GameLogEventKind::Event {
            data: "Joining instance blocked by master".into(),
        },
        first_run,
    );
    true
}

pub(super) fn parse_avatar_pedestal_change(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    let tag = "[Network Processing] RPC invoked SwitchAvatar on AvatarPedestal for ";
    if !content.starts_with(tag) {
        return false;
    }
    let data = &content[tag.len()..];
    append_event(
        inner,
        fname,
        line,
        GameLogEventKind::Event {
            data: format!("{data} changed avatar pedestal"),
        },
        first_run,
    );
    true
}

pub(super) fn parse_video_error(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    ctx: &mut LogContext,
    first_run: bool,
) -> bool {
    const YT_BOT_ERROR: &str = "Sign in to confirm";
    const YT_BOT_FIX: &str = "[VRCX] Fix error with this: https://github.com/EllyVR/VRCVideoCacher";

    if content.contains("[Video Playback] ERROR: ") {
        if let Some(pos) = content.find("[Video Playback] ERROR: ") {
            let mut data = content[pos + 24..].to_string();
            if !ctx.video_errors.insert(data.clone()) {
                return true;
            }
            if data.contains(YT_BOT_ERROR) {
                data = format!("{YT_BOT_FIX}\n{data}");
            }
            append_event(
                inner,
                fname,
                line,
                GameLogEventKind::Event {
                    data: format!("VideoError: {data}"),
                },
                first_run,
            );
        }
        return true;
    }

    if content.contains("[AVProVideo] Error: ") {
        if let Some(pos) = content.find("[AVProVideo] Error: ") {
            let mut data = content[pos + 20..].to_string();
            if !ctx.video_errors.insert(data.clone()) {
                return true;
            }
            if data.contains(YT_BOT_ERROR) {
                data = format!("{YT_BOT_FIX}\n{data}");
            }
            append_event(
                inner,
                fname,
                line,
                GameLogEventKind::Event {
                    data: format!("VideoError: {data}"),
                },
                first_run,
            );
        }
        return true;
    }

    false
}

pub(super) fn parse_video_change(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    let tag = "[Video Playback] Attempting to resolve URL '";
    if !content.starts_with(tag) {
        return false;
    }
    let rest = &content[tag.len()..];
    if let Some(end) = rest.rfind('\'') {
        let url = &rest[..end];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::VideoPlay {
                video_url: url.into(),
                display_name: String::new(),
            },
            first_run,
        );
    }
    true
}

pub(super) fn parse_avpro_video_change(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    let tag = "[Video Playback] Resolving URL '";
    if !content.starts_with(tag) {
        return false;
    }
    let rest = &content[tag.len()..];
    if let Some(end) = rest.rfind('\'') {
        let url = &rest[..end];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::VideoPlay {
                video_url: url.into(),
                display_name: String::new(),
            },
            first_run,
        );
    }
    true
}

pub(super) fn parse_sdk2_video_play(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.starts_with("User ") {
        return false;
    }
    if let Some(pos) = content.rfind(" added URL ") {
        let display_name = &content[5..pos];
        let url = &content[pos + 11..];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::VideoPlay {
                video_url: url.into(),
                display_name: display_name.into(),
            },
            first_run,
        );
        return true;
    }
    false
}

pub(super) fn parse_usharp_video_play(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    let tag = "[USharpVideo] Started video load for URL: ";
    if !content.starts_with(tag) {
        return false;
    }
    if let Some(pos) = content.rfind(", requested by ") {
        let url = &content[tag.len()..pos];
        let display_name = &content[pos + 15..];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::VideoPlay {
                video_url: url.into(),
                display_name: display_name.into(),
            },
            first_run,
        );
    }
    true
}

pub(super) fn parse_usharp_video_sync(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    let tag = "[USharpVideo] Syncing video to ";
    if !content.starts_with(tag) {
        return false;
    }
    let data = &content[tag.len()..];
    append_event(
        inner,
        fname,
        line,
        GameLogEventKind::VideoSync {
            timestamp: data.into(),
        },
        first_run,
    );
    true
}

pub(super) fn parse_world_vrcx(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.starts_with("[VRCX] ") {
        return false;
    }
    let data = &content[7..];
    append_event(
        inner,
        fname,
        line,
        GameLogEventKind::Vrcx { data: data.into() },
        first_run,
    );
    true
}

pub(super) fn parse_screenshot(
    inner: &Inner,
    fname: &str,
    line: &str,
    content: &str,
    first_run: bool,
) -> bool {
    if !content.contains("[VRC Camera] Took screenshot to: ") {
        return false;
    }
    if let Some(pos) = line.rfind("] Took screenshot to: ") {
        let path = &line[pos + 22..];
        append_event(
            inner,
            fname,
            line,
            GameLogEventKind::Screenshot { path: path.into() },
            first_run,
        );
    }
    true
}
