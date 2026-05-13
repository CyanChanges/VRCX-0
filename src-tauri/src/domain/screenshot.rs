use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::domain::png;
use crate::domain::vrchat_paths;
use crate::error::AppError;
use fast_image_resize::{FilterType as FirFilterType, ResizeAlg, ResizeOptions, Resizer};
use sha2::{Digest, Sha256};

const SCREENSHOT_READY_RETRY_COUNT: usize = 10;
const SCREENSHOT_READY_RETRY_DELAY: Duration = Duration::from_secs(1);
const SCREENSHOT_CONTENT_FOLDERS: [&str; 3] = ["Prints", "Stickers", "Emoji"];
const SCREENSHOT_LIBRARY_INDEX_VERSION: i64 = 1;
const SCREENSHOT_THUMBNAIL_WIDTH: u32 = 320;
const SCREENSHOT_THUMBNAIL_HEIGHT: u32 = 180;
const SCREENSHOT_THUMBNAIL_DIMENSION_KEY: &str = "cover_16x9";
const SCREENSHOT_THUMBNAIL_RESIZE_FILTER_KEY: &str = "fir_hamming";
const SCREENSHOT_THUMBNAIL_SHARPEN_KEY: &str = "unsharpen_0_35_8";
const SCREENSHOT_THUMBNAIL_SHARPEN_SIGMA: f32 = 0.35;
const SCREENSHOT_THUMBNAIL_SHARPEN_THRESHOLD: i32 = 8;
const SCREENSHOT_THUMBNAIL_WEBP_QUALITY: f32 = 90.0;
const SCREENSHOT_THUMBNAIL_MAX_SOURCE_BYTES: i64 = 128 * 1024 * 1024;
const SCREENSHOT_THUMBNAIL_MAX_SOURCE_PIXELS: u64 = 100_000_000;
const SCREENSHOT_THUMBNAIL_HARD_LIMIT_BYTES: u64 = 500 * 1024 * 1024;
const SCREENSHOT_THUMBNAIL_TARGET_BYTES: u64 = 256 * 1024 * 1024;
const SCREENSHOT_THUMBNAIL_CLEANUP_INTERVAL_SECONDS: i64 = 60;

static SCREENSHOT_THUMBNAIL_LAST_CLEANUP_AT: AtomicI64 = AtomicI64::new(0);

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application: Option<String>,
    #[serde(default)]
    pub version: i32,
    pub author: AuthorDetail,
    pub world: WorldDetail,
    pub players: Vec<PlayerDetail>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pos: Option<[f32; 3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotLibraryScanStatus {
    pub running: bool,
    pub scanned: usize,
    pub indexed: usize,
    pub changed: usize,
    pub skipped: usize,
    pub deleted: usize,
    pub error: Option<String>,
    pub last_scan_at: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotFolderInfo {
    pub path: String,
    pub parent_path: Option<String>,
    pub name: String,
    pub image_count: usize,
    pub total_image_count: usize,
    pub latest_modified_at: Option<i64>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotFolderTree {
    pub root_path: String,
    pub folders: Vec<ScreenshotFolderInfo>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotLibraryImage {
    pub path: String,
    pub folder_path: String,
    pub file_name: String,
    pub size_bytes: i64,
    pub modified_at: i64,
    pub created_at: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub world_id: Option<String>,
    pub world_name: Option<String>,
    pub captured_at: Option<String>,
    pub metadata: Option<ScreenshotMetadata>,
    pub error: Option<String>,
}

#[derive(Clone, Debug)]
struct ScreenshotLibraryEntry {
    scan_root: String,
    path: String,
    folder_path: String,
    file_name: String,
    size_bytes: i64,
    modified_at: i64,
    created_at: Option<i64>,
    width: Option<i32>,
    height: Option<i32>,
    world_id: Option<String>,
    world_name: Option<String>,
    captured_at: Option<String>,
    metadata_json: Option<String>,
    error: Option<String>,
}

#[derive(Clone, Copy, Debug)]
struct ScreenshotLibraryCachedState {
    size_bytes: i64,
    modified_at: i64,
    index_version: i64,
}

struct ScreenshotThumbnailCacheEntry {
    thumb_path: String,
    source_path: String,
    cache_key: String,
    size_bytes: i64,
    modified_at: i64,
    last_used_at: i64,
}

struct ScreenshotThumbnailFile {
    path: PathBuf,
    size_bytes: u64,
    modified_at: i64,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorDetail {
    #[serde(default)]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldDetail {
    #[serde(default)]
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub instance_id: String,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerDetail {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pos: Option<[f32; 3]>,
}

impl ScreenshotMetadata {
    fn just_error(source_file: &str, error: &str) -> Self {
        Self {
            source_file: Some(source_file.into()),
            error: Some(error.into()),
            ..Default::default()
        }
    }

    fn contains_player_id(&self, id: &str) -> bool {
        self.players.iter().any(|p| p.id == id)
    }

    fn contains_player_name(&self, name: &str) -> bool {
        let lower = name.to_lowercase();
        self.players
            .iter()
            .any(|p| p.display_name.to_lowercase().contains(&lower))
    }
}

pub fn read_text_metadata(path: &str) -> Vec<String> {
    let mut pf = match png::PngFile::open_read(path) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let mut result = Vec::new();

    if let Some(xmp) = png::read_text_chunk("XML:com.adobe.xmp", &mut pf, false) {
        result.push(xmp);
    }
    if let Some(desc) = png::read_text_chunk("Description", &mut pf, false) {
        result.push(desc);
    }

    if result.is_empty() && pf.get_chunk(&png::ChunkType::SRGB).is_some() {
        if let Some(lfs) = png::read_text_chunk("Description", &mut pf, true) {
            result.push(lfs);
        }
    }

    result
}

pub fn delete_text_metadata(path: &str, delete_vrchat_metadata: bool) -> bool {
    if path.is_empty() || !Path::new(path).exists() || !is_png_file(path) {
        return false;
    }

    let mut pf = match png::PngFile::open_rw(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let deleted_vrchat = if delete_vrchat_metadata {
        png::delete_text_chunk("XML:com.adobe.xmp", &mut pf)
    } else {
        false
    };
    let deleted_vrcx = png::delete_text_chunk("Description", &mut pf);
    deleted_vrchat || deleted_vrcx
}

pub fn write_vrcx_metadata(text: &str, path: &str) -> bool {
    let mut pf = match png::PngFile::open_rw(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let chunk = png::generate_text_chunk("Description", text);
    pf.write_chunk(&chunk)
}

pub fn has_vrcx_metadata(path: &str) -> bool {
    let mut pf = match png::PngFile::open_read(path) {
        Ok(p) => p,
        Err(_) => return false,
    };
    pf.get_chunks_of_type(&png::ChunkType::ITXT)
        .into_iter()
        .filter_map(|chunk| chunk.read_itxt())
        .filter(|(keyword, _)| keyword == "Description")
        .map(|(_, text)| text)
        .any(|s| {
            s.starts_with('{')
                && s.ends_with('}')
                && serde_json::from_str::<ScreenshotMetadata>(&s)
                    .ok()
                    .and_then(|metadata| metadata.application)
                    .is_some_and(|application| application == "VRCX" || application == "VRCX-0")
        })
}

pub fn is_png_file(path: &str) -> bool {
    let mut f = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let len = f.seek(std::io::SeekFrom::End(0)).unwrap_or(0);
    if len < 33 {
        return false;
    }
    f.seek(std::io::SeekFrom::Start(0)).ok();
    let mut sig = [0u8; 8];
    if f.read_exact(&mut sig).is_err() {
        return false;
    }
    sig == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
}

fn is_vrchat_screenshot_path(path: &Path) -> bool {
    let is_png = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    let has_vrchat_prefix = path
        .file_stem()
        .and_then(|file_stem| file_stem.to_str())
        .is_some_and(|file_stem| file_stem.starts_with("VRChat_"));

    is_png && has_vrchat_prefix
}

fn sleep_before_next_screenshot_attempt(attempt: usize) {
    if attempt + 1 < SCREENSHOT_READY_RETRY_COUNT {
        std::thread::sleep(SCREENSHOT_READY_RETRY_DELAY);
    }
}

fn can_decode_image(path: &Path) -> bool {
    std::fs::read(path)
        .ok()
        .and_then(|data| image::load_from_memory(&data).ok())
        .is_some()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn unix_time_millis(time: std::time::SystemTime) -> i64 {
    time.duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn now_unix_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn now_rfc3339() -> String {
    let now: chrono::DateTime<chrono::Utc> = std::time::SystemTime::now().into();
    now.to_rfc3339()
}

fn read_png_dimensions(path: &str) -> (Option<i32>, Option<i32>) {
    let Ok(mut png) = png::PngFile::open_read(path) else {
        return (None, None);
    };
    let resolution = png::read_resolution(&mut png);
    let Some((width, height)) = resolution.split_once('x') else {
        return (None, None);
    };
    let width = width.parse::<i32>().ok().filter(|value| *value > 0);
    let height = height.parse::<i32>().ok().filter(|value| *value > 0);
    (width, height)
}

fn option_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn screenshot_path_with_world_id(path: &Path, world_id: &str) -> Option<PathBuf> {
    let file_stem = path.file_stem()?.to_str()?;
    let extension = path.extension()?.to_str()?;
    Some(path.with_file_name(format!("{file_stem}_{world_id}.{extension}")))
}

use std::io::{Read, Seek};

pub fn parse_vrc_image(xml_string: &str) -> ScreenshotMetadata {
    let idx = match xml_string.find("<x:xmpmeta") {
        Some(i) => i,
        None => return ScreenshotMetadata::default(),
    };
    let xml = &xml_string[idx..];

    let mut creator_tool: Option<String> = None;
    let mut author_name: Option<String> = None;
    let mut author_id: Option<String> = None;
    let mut date_time: Option<String> = None;
    let mut note: Option<String> = None;
    let mut world_id: Option<String> = None;
    let mut world_display_name: Option<String> = None;

    use quick_xml::escape::unescape;
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    let mut current_tag = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                current_tag = name;
            }
            Ok(Event::Text(ref e)) => {
                let text = e
                    .decode()
                    .ok()
                    .and_then(|text| unescape(&text).ok().map(|text| text.into_owned()))
                    .unwrap_or_default();
                if text.trim().is_empty() {
                    continue;
                }
                match current_tag.as_str() {
                    "CreatorTool" => creator_tool = Some(text),
                    "Author" => author_name = Some(text),
                    "DateTime" => date_time = Some(text),
                    "li" if note.is_none() => {
                        note = Some(text);
                    }
                    "WorldID" | "World" if world_id.is_none() => {
                        world_id = Some(text);
                    }
                    "WorldDisplayName" => world_display_name = Some(text),
                    "AuthorID" => author_id = Some(text),
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if author_id.is_none() {
        author_id = author_name.take();
    }

    ScreenshotMetadata {
        application: creator_tool,
        version: 1,
        author: AuthorDetail {
            id: author_id.unwrap_or_default(),
            display_name: author_name,
        },
        world: WorldDetail {
            id: world_id.clone().unwrap_or_default(),
            name: world_display_name,
            instance_id: world_id.unwrap_or_default(),
        },
        timestamp: date_time,
        note,
        ..Default::default()
    }
}

pub fn parse_lfs_picture(metadata_string: &str) -> ScreenshotMetadata {
    let mut metadata = ScreenshotMetadata::default();
    let mut parts: Vec<&str> = metadata_string.split('|').collect();

    if parts.len() > 1 && parts[1] == "cvr" {
        parts.remove(0);
    }

    if parts.len() < 2 {
        return metadata;
    }

    let application = parts[0];
    let version: i32 = parts[1].parse().unwrap_or(0);
    metadata.application = Some(application.into());
    metadata.version = version;

    let is_cvr = application == "cvr";

    if application == "screenshotmanager" {
        if parts.len() >= 4 {
            let author_parts: Vec<&str> = parts[2]
                .strip_prefix("author:")
                .unwrap_or(parts[2])
                .split(',')
                .collect();
            if author_parts.len() >= 2 {
                metadata.author.id = author_parts[0].into();
                metadata.author.display_name = Some(author_parts[1].into());
            }
            let world_parts: Vec<&str> = parts[3].split(',').collect();
            if world_parts.len() >= 3 {
                metadata.world.id = world_parts[0].into();
                metadata.world.name = Some(world_parts[2].into());
                metadata.world.instance_id = format!("{}:{}", world_parts[0], world_parts[1]);
            }
        }
        return metadata;
    }

    for part in parts.iter().skip(2) {
        let split: Vec<&str> = part.splitn(2, ':').collect();
        if split.len() < 2 || split[1].is_empty() {
            continue;
        }
        let key = split[0];
        let value = split[1];
        let sub_parts: Vec<&str> = value.split(',').collect();

        match key {
            "author" if sub_parts.len() >= 2 => {
                metadata.author.id = if is_cvr {
                    String::new()
                } else {
                    sub_parts[0].into()
                };
                metadata.author.display_name = Some(if is_cvr {
                    format!("{} ({})", sub_parts[1], sub_parts[0])
                } else {
                    sub_parts[1].into()
                });
            }
            "world" => {
                if is_cvr || version == 1 {
                    metadata.world.id = String::new();
                    metadata.world.instance_id = String::new();
                    metadata.world.name = Some(if is_cvr && sub_parts.len() >= 3 {
                        format!("{} ({})", sub_parts[2], sub_parts[0])
                    } else {
                        value.into()
                    });
                } else if sub_parts.len() >= 3 {
                    metadata.world.id = sub_parts[0].into();
                    metadata.world.instance_id = format!("{}:{}", sub_parts[0], sub_parts[1]);
                    metadata.world.name = Some(sub_parts[2].into());
                }
            }
            "pos" if sub_parts.len() >= 3 => {
                let x: f32 = sub_parts[0].parse().unwrap_or(0.0);
                let y: f32 = sub_parts[1].parse().unwrap_or(0.0);
                let z: f32 = sub_parts[2].parse().unwrap_or(0.0);
                metadata.pos = Some([x, y, z]);
            }
            "players" => {
                let players_str = value.split(';');
                for player in players_str {
                    let pp: Vec<&str> = player.split(',').collect();
                    if pp.len() >= 5 {
                        let x: f32 = pp[1].parse().unwrap_or(0.0);
                        let y: f32 = pp[2].parse().unwrap_or(0.0);
                        let z: f32 = pp[3].parse().unwrap_or(0.0);
                        metadata.players.push(PlayerDetail {
                            id: if is_cvr { String::new() } else { pp[0].into() },
                            display_name: if is_cvr {
                                format!("{} ({})", pp[4], pp[0])
                            } else {
                                pp[4].into()
                            },
                            pos: Some([x, y, z]),
                        });
                    }
                }
            }
            _ => {}
        }
    }

    metadata
}

pub fn get_screenshot_metadata(path: &str) -> Option<ScreenshotMetadata> {
    let p = Path::new(path);
    let is_png_extension = p
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    if !p.exists() || !is_png_extension {
        return None;
    }

    let metadata_strs = read_text_metadata(path);
    if metadata_strs.is_empty() {
        return Some(ScreenshotMetadata::just_error(
            path,
            "Image has no valid metadata.",
        ));
    }

    let mut result = ScreenshotMetadata::default();
    let mut got_vrchat = false;

    for s in &metadata_strs {
        if s.contains("<x:xmpmeta") {
            result = parse_vrc_image(s);
            result.source_file = Some(path.into());
            got_vrchat = true;
        } else if s.starts_with('{') && s.ends_with('}') {
            if let Ok(mut vrcx) = serde_json::from_str::<ScreenshotMetadata>(s) {
                vrcx.source_file = Some(path.into());
                if got_vrchat {
                    result.players = vrcx.players;
                    result.world.instance_id = vrcx.world.instance_id;
                } else {
                    result = vrcx;
                }
            }
        } else if s.starts_with("lfs") || s.starts_with("screenshotmanager") {
            result = parse_lfs_picture(s);
            result.source_file = Some(path.into());
        }
    }

    if result.application.is_none() {
        return Some(ScreenshotMetadata::just_error(
            path,
            "Image has no valid metadata.",
        ));
    }

    Some(result)
}

pub fn extra_screenshot_data(path: &str, carousel_cache: bool) -> Result<String, AppError> {
    let p = Path::new(path);
    let mut result = serde_json::Map::new();

    result.insert("filePath".into(), serde_json::json!(path));

    if let Ok(meta) = std::fs::metadata(p) {
        if let Ok(created) = meta.created() {
            let dt: chrono::DateTime<chrono::Utc> = created.into();
            result.insert("creationDate".into(), serde_json::json!(dt.to_rfc3339()));
        }
        result.insert("fileSizeBytes".into(), serde_json::json!(meta.len()));
    }
    if is_png_file(path) {
        let mut png = png::PngFile::open_read(path);
        if let Ok(ref mut png) = png {
            let res = png::read_resolution(png);
            if !res.is_empty() {
                result.insert("resolution".into(), serde_json::json!(res));
            }
        }
    }
    let file_name = p
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    result.insert("fileName".into(), serde_json::json!(file_name));

    if carousel_cache {
        if let Some(parent) = p.parent() {
            if let Ok(entries) = std::fs::read_dir(parent) {
                let mut pngs: Vec<String> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path()
                            .extension()
                            .is_some_and(|ext| ext.eq_ignore_ascii_case("png"))
                    })
                    .map(|e| e.path().to_string_lossy().into_owned())
                    .collect();
                pngs.sort();
                if let Some(idx) = pngs.iter().position(|f| f == path) {
                    if idx > 0 {
                        result.insert("previousFilePath".into(), serde_json::json!(pngs[idx - 1]));
                    }
                    if idx + 1 < pngs.len() {
                        result.insert("nextFilePath".into(), serde_json::json!(pngs[idx + 1]));
                    }
                }
            }
        }
    }

    serde_json::to_string(&result).map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

fn screenshot_error_json(path: &str, error: &str) -> Result<String, AppError> {
    serde_json::to_string(&serde_json::json!({
        "sourceFile": path,
        "error": error,
    }))
    .map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

pub fn screenshot_metadata_json(path: &str) -> Result<String, AppError> {
    match get_screenshot_metadata(path) {
        Some(meta) => {
            if let Some(error) = meta.error.as_deref() {
                return screenshot_error_json(meta.source_file.as_deref().unwrap_or(path), error);
            }

            serde_json::to_string(&meta).map_err(|e| AppError::Custom(format!("serialize: {e}")))
        }
        None => screenshot_error_json(path, "Screenshot contains no metadata."),
    }
}

pub fn find_screenshots_json(
    search_query: &str,
    search_type: Option<i32>,
    cache: &MetadataCacheDb,
) -> Result<String, AppError> {
    let st = SearchType::from_i32(search_type.unwrap_or(0));
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return Ok("[]".into());
    }
    let results = find_screenshots(search_query, &photos_dir, st, cache);
    serde_json::to_string(&results).map_err(|e| AppError::Custom(format!("serialize: {e}")))
}

fn is_screenshot_content_asset_path(path: &Path) -> bool {
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        SCREENSHOT_CONTENT_FOLDERS
            .iter()
            .any(|folder| name.eq_ignore_ascii_case(folder))
    })
}

fn screenshot_file_time(path: &Path) -> Option<std::time::SystemTime> {
    let meta = std::fs::metadata(path).ok()?;
    meta.created().or_else(|_| meta.modified()).ok()
}

fn last_screenshot_in(photos_dir: &Path) -> String {
    if !photos_dir.is_dir() {
        return String::new();
    }

    walkdir::WalkDir::new(photos_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
                && !is_screenshot_content_asset_path(path)
        })
        .filter_map(|path| screenshot_file_time(&path).map(|time| (path, time)))
        .max_by_key(|(_, time)| *time)
        .map(|(path, _)| path.to_string_lossy().into_owned())
        .unwrap_or_default()
}

pub fn last_screenshot() -> String {
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return String::new();
    }
    last_screenshot_in(Path::new(&photos_dir))
}

pub fn delete_all_screenshot_metadata(cache: &MetadataCacheDb, thumbnail_cache_dir: &Path) {
    let photos_dir = vrchat_paths::vrchat_photos_location();
    if photos_dir.is_empty() {
        return;
    }
    for entry in walkdir::WalkDir::new(&photos_dir).into_iter().flatten() {
        if entry.file_type().is_file()
            && entry
                .path()
                .extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("png"))
        {
            delete_text_metadata(&entry.path().to_string_lossy(), true);
        }
    }
    cache.clear_all();
    delete_all_thumbnail_cache_files(thumbnail_cache_dir, cache);
}

pub fn add_screenshot_metadata(
    path: &str,
    metadata_string: &str,
    world_id: &str,
    change_filename: bool,
) -> String {
    let original_path = PathBuf::from(path);
    if !is_vrchat_screenshot_path(&original_path) {
        return String::new();
    }

    let mut current_path = original_path;
    let mut renamed = false;

    for attempt in 0..SCREENSHOT_READY_RETRY_COUNT {
        let current_path_string = path_string(&current_path);
        if !is_png_file(&current_path_string) || !can_decode_image(&current_path) {
            sleep_before_next_screenshot_attempt(attempt);
            continue;
        }

        if has_vrcx_metadata(&current_path_string) {
            return current_path_string;
        }

        if change_filename && !renamed {
            let Some(next_path) = screenshot_path_with_world_id(&current_path, world_id) else {
                return String::new();
            };

            if next_path != current_path {
                match std::fs::rename(&current_path, &next_path) {
                    Ok(()) => {
                        current_path = next_path;
                    }
                    Err(_) => {
                        sleep_before_next_screenshot_attempt(attempt);
                        continue;
                    }
                }
            }
            renamed = true;
        }

        let current_path_string = path_string(&current_path);
        if write_vrcx_metadata(metadata_string, &current_path_string) {
            return current_path_string;
        }

        sleep_before_next_screenshot_attempt(attempt);
    }

    String::new()
}

#[derive(Clone, Copy)]
pub enum SearchType {
    Username = 0,
    UserID = 1,
    WorldName = 2,
    WorldID = 3,
}

impl SearchType {
    pub fn from_i32(v: i32) -> Self {
        match v {
            1 => Self::UserID,
            2 => Self::WorldName,
            3 => Self::WorldID,
            _ => Self::Username,
        }
    }
}

pub fn find_screenshots(
    query: &str,
    directory: &str,
    search_type: SearchType,
    cache_db: &MetadataCacheDb,
) -> Vec<String> {
    let dir = Path::new(directory);
    if !dir.exists() {
        return Vec::new();
    }

    let mut result = Vec::new();
    let mut to_cache: Vec<(String, Option<String>)> = Vec::new();

    let files: Vec<String> = walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path()
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("png"))
        })
        .map(|e| e.path().to_string_lossy().into_owned())
        .collect();

    for file in &files {
        let metadata = if let Some(cached) = cache_db.get_metadata(file) {
            serde_json::from_str::<ScreenshotMetadata>(&cached).ok()
        } else if cache_db.is_cached(file) {
            None
        } else {
            let m = get_screenshot_metadata(file);
            let json = m
                .as_ref()
                .filter(|m| m.error.is_none())
                .and_then(|m| serde_json::to_string(m).ok());
            to_cache.push((file.clone(), json));
            m.filter(|m| m.error.is_none())
        };

        if let Some(ref meta) = metadata {
            let matched = match search_type {
                SearchType::Username => meta.contains_player_name(query),
                SearchType::UserID => meta.contains_player_id(query),
                SearchType::WorldName => meta
                    .world
                    .name
                    .as_ref()
                    .is_some_and(|n| n.to_lowercase().contains(&query.to_lowercase())),
                SearchType::WorldID => meta.world.id == query,
            };
            if matched {
                if let Some(ref sf) = meta.source_file {
                    result.push(sf.clone());
                } else {
                    result.push(file.clone());
                }
            }
        }
    }

    if !to_cache.is_empty() {
        cache_db.bulk_add(&to_cache);
    }

    result
}

fn screenshot_library_entry_from_path(
    scan_root: &str,
    path: &Path,
) -> Option<ScreenshotLibraryEntry> {
    let metadata = std::fs::metadata(path).ok()?;
    let path_value = path_string(path);
    let folder_path = path.parent().map(path_string).unwrap_or_default();
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let modified_at = metadata
        .modified()
        .map(unix_time_millis)
        .unwrap_or_default();
    let created_at = metadata.created().ok().map(unix_time_millis);
    let (width, height) = read_png_dimensions(&path_value);
    let screenshot_metadata = get_screenshot_metadata(&path_value);
    let error = screenshot_metadata
        .as_ref()
        .and_then(|metadata| metadata.error.clone());
    let metadata_json = screenshot_metadata
        .as_ref()
        .filter(|metadata| metadata.error.is_none())
        .and_then(|metadata| serde_json::to_string(metadata).ok());
    let (world_id, world_name, captured_at) = screenshot_metadata
        .as_ref()
        .filter(|metadata| metadata.error.is_none())
        .map(|metadata| {
            (
                option_string(&metadata.world.id),
                metadata
                    .world
                    .name
                    .clone()
                    .filter(|value| !value.is_empty()),
                metadata.timestamp.clone().filter(|value| !value.is_empty()),
            )
        })
        .unwrap_or_default();

    Some(ScreenshotLibraryEntry {
        scan_root: scan_root.to_string(),
        path: path_value,
        folder_path,
        file_name,
        size_bytes: metadata.len() as i64,
        modified_at,
        created_at,
        width,
        height,
        world_id,
        world_name,
        captured_at,
        metadata_json,
        error,
    })
}

fn scan_screenshot_library_in(
    root: &Path,
    cache: &MetadataCacheDb,
    thumbnail_cache_dir: Option<&Path>,
    force: bool,
) -> ScreenshotLibraryScanStatus {
    let mut status = ScreenshotLibraryScanStatus {
        running: true,
        ..Default::default()
    };

    if !root.is_dir() {
        status.running = false;
        status.error = Some("Screenshot folder does not exist.".into());
        status.last_scan_at = Some(now_rfc3339());
        return status;
    }

    let root_string = path_string(root);
    let existing = cache.library_file_states(&root_string);
    let mut seen = HashSet::new();
    let mut changed_entries = Vec::new();
    let mut traversal_error_count = 0usize;
    let mut file_error_count = 0usize;

    for entry in walkdir::WalkDir::new(root).into_iter() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                traversal_error_count += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
            || is_screenshot_content_asset_path(path)
        {
            continue;
        }

        status.scanned += 1;
        let path_value = path_string(path);
        seen.insert(path_value.clone());
        let Ok(metadata) = std::fs::metadata(path) else {
            file_error_count += 1;
            continue;
        };
        let size_bytes = metadata.len() as i64;
        let modified_at = metadata
            .modified()
            .map(unix_time_millis)
            .unwrap_or_default();

        if !force
            && existing.get(&path_value).is_some_and(|cached| {
                cached.size_bytes == size_bytes
                    && cached.modified_at == modified_at
                    && cached.index_version >= SCREENSHOT_LIBRARY_INDEX_VERSION
            })
        {
            status.skipped += 1;
            continue;
        }

        if let Some(library_entry) = screenshot_library_entry_from_path(&root_string, path) {
            changed_entries.push(library_entry);
            status.changed += 1;
        } else {
            file_error_count += 1;
        }
    }

    status.indexed = changed_entries.len();
    let prune_missing = traversal_error_count == 0 && file_error_count == 0;
    let deleted_source_paths = if prune_missing {
        existing
            .keys()
            .filter(|path| !seen.contains(*path))
            .cloned()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    let mut errors = Vec::new();
    match cache.replace_library_entries(&root_string, &seen, &changed_entries, prune_missing) {
        Ok(deleted) => {
            status.deleted = deleted;
            if deleted > 0 {
                if let Some(cache_dir) = thumbnail_cache_dir {
                    delete_thumbnail_cache_for_source_paths(
                        cache_dir,
                        cache,
                        &deleted_source_paths,
                    );
                }
            }
        }
        Err(error) => {
            errors.push(error);
        }
    }
    if traversal_error_count > 0 {
        errors.push(format!(
            "Failed to read {traversal_error_count} screenshot entries; skipped pruning missing files."
        ));
    }
    if file_error_count > 0 {
        errors.push(format!(
            "Failed to read {file_error_count} screenshot files; skipped pruning missing files."
        ));
    }
    if !errors.is_empty() {
        status.error = Some(errors.join(" "));
    }
    status.running = false;
    status.last_scan_at = Some(now_rfc3339());
    status
}

pub fn start_screenshot_library_scan(
    cache: &MetadataCacheDb,
    thumbnail_cache_dir: PathBuf,
    force: bool,
) -> ScreenshotLibraryScanStatus {
    let root = vrchat_paths::vrchat_photos_location();
    if root.is_empty() {
        let status = ScreenshotLibraryScanStatus {
            running: false,
            error: Some("VRChat photos folder is not configured.".into()),
            last_scan_at: Some(now_rfc3339()),
            ..Default::default()
        };
        cache.set_scan_status(status.clone());
        return status;
    }

    if cache
        .scan_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return cache.scan_status();
    }

    let cache_for_scan = cache.clone();
    cache.set_scan_status(ScreenshotLibraryScanStatus {
        running: true,
        ..Default::default()
    });
    std::thread::spawn(move || {
        let status = scan_screenshot_library_in(
            Path::new(&root),
            &cache_for_scan,
            Some(&thumbnail_cache_dir),
            force,
        );
        cache_for_scan.set_scan_status(status);
        cache_for_scan.scan_running.store(false, Ordering::SeqCst);
    });

    cache.scan_status()
}

fn screenshot_thumbnail_cache_key(path: &str, size_bytes: i64, modified_at: i64) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update(b"\0");
    hasher.update(size_bytes.to_le_bytes());
    hasher.update(modified_at.to_le_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_DIMENSION_KEY.as_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_WIDTH.to_le_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_HEIGHT.to_le_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_RESIZE_FILTER_KEY.as_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_SHARPEN_KEY.as_bytes());
    hasher.update(SCREENSHOT_THUMBNAIL_WEBP_QUALITY.to_le_bytes());
    hasher.update(b"webp");
    hex::encode(hasher.finalize())
}

fn screenshot_thumbnail_source_state(path: &Path) -> Result<(i64, i64), AppError> {
    let metadata = std::fs::metadata(path)?;
    let modified_at = metadata
        .modified()
        .map(unix_time_millis)
        .unwrap_or_default();
    Ok((metadata.len() as i64, modified_at))
}

fn screenshot_thumbnail_files(cache_dir: &Path) -> Vec<ScreenshotThumbnailFile> {
    let Ok(entries) = std::fs::read_dir(cache_dir) else {
        return Vec::new();
    };

    entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("webp"))
        })
        .filter_map(|path| {
            let metadata = std::fs::metadata(&path).ok()?;
            let modified_at = metadata
                .modified()
                .map(unix_time_millis)
                .unwrap_or_default();
            Some(ScreenshotThumbnailFile {
                path,
                size_bytes: metadata.len(),
                modified_at,
            })
        })
        .collect()
}

fn screenshot_thumbnail_cache_size(cache_dir: &Path) -> u64 {
    screenshot_thumbnail_files(cache_dir)
        .into_iter()
        .map(|file| file.size_bytes)
        .sum()
}

fn remove_thumbnail_file(path: &Path, cache_dir: &Path, cache: &MetadataCacheDb) -> u64 {
    if path.exists() && !is_path_inside_directory(path, cache_dir) {
        return 0;
    }
    let size = std::fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let _ = std::fs::remove_file(path);
    cache.delete_thumbnail_cache_record(&path_string(path));
    size
}

fn delete_thumbnail_cache_for_source_paths(
    cache_dir: &Path,
    cache: &MetadataCacheDb,
    source_paths: &[String],
) {
    if source_paths.is_empty() {
        return;
    }
    let source_path_set = source_paths
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    for entry in cache.thumbnail_cache_entries() {
        if source_path_set.contains(entry.source_path.as_str()) {
            remove_thumbnail_file(&PathBuf::from(entry.thumb_path), cache_dir, cache);
        }
    }
}

fn delete_stale_thumbnail_cache_for_source(
    cache_dir: &Path,
    cache: &MetadataCacheDb,
    source_path: &str,
    current_cache_key: &str,
) {
    for entry in cache.thumbnail_cache_entries_for_source(source_path) {
        if entry.cache_key != current_cache_key {
            remove_thumbnail_file(&PathBuf::from(entry.thumb_path), cache_dir, cache);
        }
    }
}

fn delete_all_thumbnail_cache_files(cache_dir: &Path, cache: &MetadataCacheDb) {
    for file in screenshot_thumbnail_files(cache_dir) {
        remove_thumbnail_file(&file.path, cache_dir, cache);
    }
}

fn cleanup_screenshot_thumbnail_cache(cache_dir: &Path, cache: &MetadataCacheDb) {
    SCREENSHOT_THUMBNAIL_LAST_CLEANUP_AT.store(now_unix_seconds(), Ordering::Release);
    let mut total_size = screenshot_thumbnail_cache_size(cache_dir);

    for entry in cache.thumbnail_cache_entries() {
        let thumb_path = PathBuf::from(&entry.thumb_path);
        let source_path = PathBuf::from(&entry.source_path);
        let source_state = screenshot_thumbnail_source_state(&source_path).ok();
        let source_stale = source_state
            .map(|(size_bytes, modified_at)| {
                size_bytes != entry.size_bytes
                    || modified_at != entry.modified_at
                    || screenshot_thumbnail_cache_key(&entry.source_path, size_bytes, modified_at)
                        != entry.cache_key
            })
            .unwrap_or(true);
        if source_stale || !thumb_path.is_file() {
            total_size =
                total_size.saturating_sub(remove_thumbnail_file(&thumb_path, cache_dir, cache));
        }
    }

    if total_size <= SCREENSHOT_THUMBNAIL_HARD_LIMIT_BYTES {
        return;
    }

    if total_size <= SCREENSHOT_THUMBNAIL_TARGET_BYTES {
        return;
    }

    let last_used_by_path = cache.thumbnail_last_used_map();
    let mut files = screenshot_thumbnail_files(cache_dir);
    files.sort_by_key(|file| {
        last_used_by_path
            .get(&path_string(&file.path))
            .copied()
            .unwrap_or(file.modified_at)
    });

    for file in files {
        if total_size <= SCREENSHOT_THUMBNAIL_TARGET_BYTES {
            break;
        }
        total_size = total_size.saturating_sub(remove_thumbnail_file(&file.path, cache_dir, cache));
    }
}

fn cleanup_screenshot_thumbnail_cache_if_due(cache_dir: &Path, cache: &MetadataCacheDb) {
    let now = now_unix_seconds();
    let last_cleanup = SCREENSHOT_THUMBNAIL_LAST_CLEANUP_AT.load(Ordering::Relaxed);
    if now.saturating_sub(last_cleanup) < SCREENSHOT_THUMBNAIL_CLEANUP_INTERVAL_SECONDS {
        return;
    }
    if SCREENSHOT_THUMBNAIL_LAST_CLEANUP_AT
        .compare_exchange(last_cleanup, now, Ordering::AcqRel, Ordering::Relaxed)
        .is_ok()
    {
        cleanup_screenshot_thumbnail_cache(cache_dir, cache);
    }
}

fn validate_screenshot_thumbnail_source(
    path: &Path,
    source_root: &Path,
    size_bytes: i64,
) -> Result<(u32, u32), AppError> {
    if size_bytes > SCREENSHOT_THUMBNAIL_MAX_SOURCE_BYTES {
        return Err(AppError::Custom(
            "Screenshot image is too large for thumbnailing.".into(),
        ));
    }

    if source_root.as_os_str().is_empty() {
        return Err(AppError::Custom(
            "VRChat photos folder is not configured.".into(),
        ));
    }
    if !is_path_inside_directory(path, source_root) {
        return Err(AppError::Custom(
            "Screenshot thumbnail source is outside the VRChat photos folder.".into(),
        ));
    }

    let (width, height) = image::image_dimensions(path)
        .map_err(|error| AppError::Custom(format!("read screenshot dimensions: {error}")))?;
    let pixels = u64::from(width) * u64::from(height);
    if pixels > SCREENSHOT_THUMBNAIL_MAX_SOURCE_PIXELS {
        return Err(AppError::Custom(
            "Screenshot image is too large for thumbnailing.".into(),
        ));
    }

    Ok((width, height))
}

fn write_thumbnail_atomically(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Custom("Invalid thumbnail cache path.".into()))?;
    let temp_path = path.with_file_name(format!(
        "{file_name}.{}.{}.tmp",
        std::process::id(),
        unix_time_millis(std::time::SystemTime::now())
    ));
    std::fs::write(&temp_path, bytes)?;
    if path.is_file() {
        let _ = std::fs::remove_file(&temp_path);
        return Ok(());
    }
    match std::fs::rename(&temp_path, path) {
        Ok(()) => Ok(()),
        Err(_) if path.is_file() => {
            let _ = std::fs::remove_file(&temp_path);
            Ok(())
        }
        Err(error) => {
            let _ = std::fs::remove_file(&temp_path);
            Err(AppError::Io(error))
        }
    }
}

pub fn ensure_screenshot_thumbnail(
    path: &str,
    cache_dir: &Path,
    cache: &MetadataCacheDb,
) -> Result<String, AppError> {
    let root = vrchat_paths::vrchat_photos_location();
    ensure_screenshot_thumbnail_in_root(path, cache_dir, cache, Path::new(&root))
}

fn ensure_screenshot_thumbnail_in_root(
    path: &str,
    cache_dir: &Path,
    cache: &MetadataCacheDb,
    source_root: &Path,
) -> Result<String, AppError> {
    let source_path = PathBuf::from(path);
    if !source_path.is_file() || !is_png_file(path) {
        return Err(AppError::Custom("Screenshot file is not a PNG.".into()));
    }

    let (size_bytes, modified_at) = screenshot_thumbnail_source_state(&source_path)?;

    validate_screenshot_thumbnail_source(&source_path, source_root, size_bytes)?;

    let cache_key = screenshot_thumbnail_cache_key(path, size_bytes, modified_at);
    let thumb_path = cache_dir.join(format!("{cache_key}.webp"));
    let thumb_path_string = path_string(&thumb_path);

    if thumb_path.is_file() {
        cache.record_thumbnail_cache(
            path,
            &thumb_path_string,
            &cache_key,
            size_bytes,
            modified_at,
        );
        cleanup_screenshot_thumbnail_cache_if_due(cache_dir, cache);
        return Ok(thumb_path_string);
    }

    std::fs::create_dir_all(cache_dir)?;
    delete_stale_thumbnail_cache_for_source(cache_dir, cache, path, &cache_key);

    let image = image::open(&source_path)
        .map_err(|error| AppError::Custom(format!("decode screenshot thumbnail: {error}")))?;

    let rgba_image = image.into_rgba8();

    let (thumbnail_width, thumbnail_height) =
        (SCREENSHOT_THUMBNAIL_WIDTH, SCREENSHOT_THUMBNAIL_HEIGHT);
    let mut thumbnail_rgba = image::RgbaImage::new(thumbnail_width, thumbnail_height);
    let mut resizer = Resizer::new();
    let resize_options = ResizeOptions::new()
        .resize_alg(ResizeAlg::Convolution(FirFilterType::Hamming))
        .fit_into_destination(Some((0.5, 0.5)));
    resizer
        .resize(&rgba_image, &mut thumbnail_rgba, Some(&resize_options))
        .map_err(|error| AppError::Custom(format!("resize screenshot thumbnail: {error}")))?;

    let thumbnail = image::DynamicImage::ImageRgba8(thumbnail_rgba).unsharpen(
        SCREENSHOT_THUMBNAIL_SHARPEN_SIGMA,
        SCREENSHOT_THUMBNAIL_SHARPEN_THRESHOLD,
    );

    let encoder = webp::Encoder::from_image(&thumbnail)
        .map_err(|error| AppError::Custom(format!("prepare WebP thumbnail: {error}")))?;
    let encoded = encoder.encode(SCREENSHOT_THUMBNAIL_WEBP_QUALITY);
    let encoded_bytes: &[u8] = encoded.as_ref();

    write_thumbnail_atomically(&thumb_path, encoded_bytes)?;

    cache.record_thumbnail_cache(
        path,
        &thumb_path_string,
        &cache_key,
        size_bytes,
        modified_at,
    );
    cleanup_screenshot_thumbnail_cache_if_due(cache_dir, cache);

    Ok(thumb_path_string)
}

pub fn is_path_inside_directory(path: &Path, directory: &Path) -> bool {
    let Ok(path) = path.canonicalize() else {
        return false;
    };
    let Ok(directory) = directory.canonicalize() else {
        return false;
    };
    path.starts_with(directory)
}

#[derive(Clone)]
pub struct MetadataCacheDb {
    conn: Arc<Mutex<rusqlite::Connection>>,
    scan_status: Arc<Mutex<ScreenshotLibraryScanStatus>>,
    scan_running: Arc<AtomicBool>,
}

impl MetadataCacheDb {
    pub fn new(db_path: &Path) -> Result<Self, String> {
        let conn =
            rusqlite::Connection::open(db_path).map_err(|e| format!("open cache db: {e}"))?;
        conn.execute_batch(
            "PRAGMA locking_mode=NORMAL;
             PRAGMA busy_timeout=5000;
             PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS cache (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 file_path TEXT NOT NULL UNIQUE,
                 metadata TEXT,
                 cached_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS screenshot_files (
                 path TEXT PRIMARY KEY,
                 scan_root TEXT NOT NULL DEFAULT '',
                 folder_path TEXT NOT NULL,
                 file_name TEXT NOT NULL,
                 size_bytes INTEGER NOT NULL,
                 modified_at INTEGER NOT NULL,
                 created_at INTEGER,
                 width INTEGER,
                 height INTEGER,
                 world_id TEXT,
                 world_name TEXT,
                 captured_at TEXT,
                 metadata_json TEXT,
                 index_version INTEGER NOT NULL DEFAULT 0,
                 indexed_at INTEGER NOT NULL,
                 error TEXT
             );
             CREATE TABLE IF NOT EXISTS screenshot_thumbnail_cache (
                 thumb_path TEXT PRIMARY KEY,
                 source_path TEXT NOT NULL,
                 cache_key TEXT NOT NULL,
                 size_bytes INTEGER NOT NULL,
                 modified_at INTEGER NOT NULL,
                 created_at INTEGER NOT NULL,
                 last_used_at INTEGER NOT NULL
             );",
        )
        .map_err(|e| format!("init cache db: {e}"))?;
        let _ = conn.execute(
            "ALTER TABLE screenshot_files ADD COLUMN scan_root TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE screenshot_thumbnail_cache ADD COLUMN cache_key TEXT NOT NULL DEFAULT ''",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE screenshot_files ADD COLUMN index_version INTEGER NOT NULL DEFAULT 0",
            [],
        );
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_screenshot_files_folder_path
                 ON screenshot_files(scan_root, folder_path);
             CREATE INDEX IF NOT EXISTS idx_screenshot_files_world_id
                 ON screenshot_files(scan_root, world_id);
             CREATE INDEX IF NOT EXISTS idx_screenshot_files_modified_at
                 ON screenshot_files(scan_root, modified_at);
             CREATE INDEX IF NOT EXISTS idx_screenshot_thumbnail_cache_source
                 ON screenshot_thumbnail_cache(source_path);",
        )
        .map_err(|e| format!("init screenshot db indexes: {e}"))?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            scan_status: Arc::new(Mutex::new(ScreenshotLibraryScanStatus::default())),
            scan_running: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn is_cached(&self, file_path: &str) -> bool {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT 1 FROM cache WHERE file_path = ?1 LIMIT 1",
            [file_path],
            |_| Ok(()),
        )
        .is_ok()
    }

    pub fn get_metadata(&self, file_path: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT metadata FROM cache WHERE file_path = ?1 LIMIT 1",
            [file_path],
            |row| row.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
    }

    pub fn bulk_add(&self, entries: &[(String, Option<String>)]) {
        let conn = self.conn.lock().unwrap();
        let tx = match conn.unchecked_transaction() {
            Ok(t) => t,
            Err(_) => return,
        };
        {
            let mut stmt = match tx.prepare(
                "INSERT OR IGNORE INTO cache (file_path, metadata, cached_at) VALUES (?1, ?2, ?3)",
            ) {
                Ok(s) => s,
                Err(_) => return,
            };
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            for (path, meta) in entries {
                let _ = stmt.execute(rusqlite::params![path, meta.as_deref(), now]);
            }
        }
        let _ = tx.commit();
    }

    pub fn scan_status(&self) -> ScreenshotLibraryScanStatus {
        self.scan_status.lock().unwrap().clone()
    }

    fn set_scan_status(&self, status: ScreenshotLibraryScanStatus) {
        *self.scan_status.lock().unwrap() = status;
    }

    fn library_file_states(&self, root: &str) -> HashMap<String, ScreenshotLibraryCachedState> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT path, size_bytes, modified_at, index_version
             FROM screenshot_files
             WHERE scan_root = ?1",
        ) {
            Ok(stmt) => stmt,
            Err(_) => return HashMap::new(),
        };
        let rows = match stmt.query_map([root], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        }) {
            Ok(rows) => rows,
            Err(_) => return HashMap::new(),
        };
        rows.filter_map(|row| row.ok())
            .map(|(path, size_bytes, modified_at, index_version)| {
                (
                    path,
                    ScreenshotLibraryCachedState {
                        size_bytes,
                        modified_at,
                        index_version,
                    },
                )
            })
            .collect()
    }

    fn replace_library_entries(
        &self,
        root: &str,
        seen: &HashSet<String>,
        entries: &[ScreenshotLibraryEntry],
        prune_missing: bool,
    ) -> Result<usize, String> {
        let conn = self.conn.lock().unwrap();
        let tx = conn
            .unchecked_transaction()
            .map_err(|error| format!("start screenshot index transaction: {error}"))?;
        let now = now_unix_seconds();

        {
            let mut stmt = tx
                .prepare(
                    "INSERT INTO screenshot_files (
                    path, scan_root, folder_path, file_name, size_bytes, modified_at, created_at,
                    width, height, world_id, world_name, captured_at, metadata_json,
                    index_version, indexed_at, error
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                 ON CONFLICT(path) DO UPDATE SET
                    scan_root = excluded.scan_root,
                    folder_path = excluded.folder_path,
                    file_name = excluded.file_name,
                    size_bytes = excluded.size_bytes,
                    modified_at = excluded.modified_at,
                    created_at = excluded.created_at,
                    width = excluded.width,
                    height = excluded.height,
                    world_id = excluded.world_id,
                    world_name = excluded.world_name,
                    captured_at = excluded.captured_at,
                    metadata_json = excluded.metadata_json,
                    index_version = excluded.index_version,
                    indexed_at = excluded.indexed_at,
                    error = excluded.error",
                )
                .map_err(|error| format!("prepare screenshot index upsert: {error}"))?;

            for entry in entries {
                stmt.execute(rusqlite::params![
                    entry.path.as_str(),
                    entry.scan_root.as_str(),
                    entry.folder_path.as_str(),
                    entry.file_name.as_str(),
                    entry.size_bytes,
                    entry.modified_at,
                    entry.created_at,
                    entry.width,
                    entry.height,
                    entry.world_id.as_deref(),
                    entry.world_name.as_deref(),
                    entry.captured_at.as_deref(),
                    entry.metadata_json.as_deref(),
                    SCREENSHOT_LIBRARY_INDEX_VERSION,
                    now,
                    entry.error.as_deref(),
                ])
                .map_err(|error| format!("write screenshot index row: {error}"))?;
            }
        }

        let mut deleted = 0;
        if prune_missing {
            let existing_paths = {
                let mut stmt = tx
                    .prepare("SELECT path FROM screenshot_files WHERE scan_root = ?1")
                    .map_err(|error| format!("prepare screenshot index prune: {error}"))?;
                let rows = stmt
                    .query_map([root], |row| row.get::<_, String>(0))
                    .map_err(|error| format!("read screenshot index prune set: {error}"))?;
                rows.filter_map(|row| row.ok()).collect::<Vec<_>>()
            };

            for path in existing_paths {
                if !seen.contains(&path) {
                    tx.execute("DELETE FROM screenshot_files WHERE path = ?1", [&path])
                        .map_err(|error| format!("delete stale screenshot index row: {error}"))?;
                    deleted += 1;
                }
            }
        }

        tx.commit()
            .map_err(|error| format!("commit screenshot index transaction: {error}"))?;
        Ok(deleted)
    }

    pub fn screenshot_folder_tree(&self) -> Result<ScreenshotFolderTree, AppError> {
        let root_path = vrchat_paths::vrchat_photos_location();
        self.screenshot_folder_tree_for_root(&root_path)
    }

    fn screenshot_folder_tree_for_root(
        &self,
        root_path: &str,
    ) -> Result<ScreenshotFolderTree, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut direct_counts: HashMap<String, usize> = HashMap::new();
        let mut latest_modified_by_folder: HashMap<String, i64> = HashMap::new();
        let mut stmt = conn
            .prepare(
                "SELECT folder_path, COUNT(*), MAX(modified_at)
             FROM screenshot_files
             WHERE scan_root = ?1
             GROUP BY folder_path",
            )
            .map_err(|error| {
                AppError::Database(format!("prepare screenshot folder tree: {error}"))
            })?;
        let rows = stmt
            .query_map([root_path], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            })
            .map_err(|error| AppError::Database(format!("read screenshot folder tree: {error}")))?;
        for row in rows {
            let (folder_path, count, latest_modified_at) = row.map_err(|error| {
                AppError::Database(format!("read screenshot folder row: {error}"))
            })?;
            if let Some(latest_modified_at) = latest_modified_at {
                latest_modified_by_folder.insert(folder_path.clone(), latest_modified_at);
            }
            direct_counts.insert(folder_path, count.max(0) as usize);
        }

        if root_path.is_empty() {
            return Ok(ScreenshotFolderTree {
                root_path: root_path.to_string(),
                folders: Vec::new(),
            });
        }

        let root = PathBuf::from(root_path);
        let mut folder_paths = HashSet::new();
        folder_paths.insert(root_path.to_string());
        for folder in direct_counts.keys() {
            let mut current = PathBuf::from(folder);
            loop {
                folder_paths.insert(path_string(&current));
                if current == root {
                    break;
                }
                let Some(parent) = current.parent() else {
                    break;
                };
                current = parent.to_path_buf();
            }
        }

        let mut children_by_parent: HashMap<String, Vec<String>> = HashMap::new();
        for folder in &folder_paths {
            let path = PathBuf::from(folder);
            let parent_path = path.parent().map(path_string);
            if let Some(parent_path) = parent_path {
                if folder_paths.contains(&parent_path) {
                    children_by_parent
                        .entry(parent_path)
                        .or_default()
                        .push(folder.clone());
                }
            }
        }

        fn total_count(
            path: &str,
            direct_counts: &HashMap<String, usize>,
            children_by_parent: &HashMap<String, Vec<String>>,
        ) -> usize {
            let own = direct_counts.get(path).copied().unwrap_or(0);
            own + children_by_parent
                .get(path)
                .into_iter()
                .flatten()
                .map(|child| total_count(child, direct_counts, children_by_parent))
                .sum::<usize>()
        }

        let mut folders: Vec<ScreenshotFolderInfo> = folder_paths
            .into_iter()
            .map(|folder| {
                let path = PathBuf::from(&folder);
                let parent_path = path.parent().map(path_string).filter(|parent| {
                    parent == root_path || children_by_parent.contains_key(parent)
                });
                let name = if folder == root_path {
                    path.file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .filter(|name| !name.is_empty())
                        .unwrap_or_else(|| folder.clone())
                } else {
                    path.file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_else(|| folder.clone())
                };
                ScreenshotFolderInfo {
                    latest_modified_at: latest_modified_by_folder.get(&folder).copied(),
                    image_count: direct_counts.get(&folder).copied().unwrap_or(0),
                    total_image_count: total_count(&folder, &direct_counts, &children_by_parent),
                    path: folder,
                    parent_path,
                    name,
                }
            })
            .collect();
        folders.sort_by(|left, right| {
            left.path
                .to_lowercase()
                .cmp(&right.path.to_lowercase())
                .then_with(|| left.path.cmp(&right.path))
        });

        Ok(ScreenshotFolderTree {
            root_path: root_path.to_string(),
            folders,
        })
    }

    fn map_library_image_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ScreenshotLibraryImage> {
        let metadata_json = row.get::<_, Option<String>>(12)?;
        let metadata = metadata_json
            .as_deref()
            .and_then(|value| serde_json::from_str::<ScreenshotMetadata>(value).ok());
        Ok(ScreenshotLibraryImage {
            path: row.get(0)?,
            folder_path: row.get(1)?,
            file_name: row.get(2)?,
            size_bytes: row.get(3)?,
            modified_at: row.get(4)?,
            created_at: row.get(5)?,
            width: row.get(6)?,
            height: row.get(7)?,
            world_id: row.get(8)?,
            world_name: row.get(9)?,
            captured_at: row.get(10)?,
            error: row.get(11)?,
            metadata,
        })
    }

    pub fn list_screenshot_folder_images(
        &self,
        folder_path: &str,
    ) -> Result<Vec<ScreenshotLibraryImage>, AppError> {
        let root_path = vrchat_paths::vrchat_photos_location();
        self.list_screenshot_folder_images_for_root(&root_path, folder_path)
    }

    fn list_screenshot_folder_images_for_root(
        &self,
        root_path: &str,
        folder_path: &str,
    ) -> Result<Vec<ScreenshotLibraryImage>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT path, folder_path, file_name, size_bytes, modified_at, created_at,
                    width, height, world_id, world_name, captured_at, error, metadata_json
             FROM screenshot_files
             WHERE scan_root = ?1 AND folder_path = ?2
              ORDER BY file_name ASC, modified_at ASC",
            )
            .map_err(|error| {
                AppError::Database(format!("prepare screenshot folder images: {error}"))
            })?;
        let rows = stmt
            .query_map([root_path, folder_path], Self::map_library_image_row)
            .map_err(|error| {
                AppError::Database(format!("read screenshot folder images: {error}"))
            })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|error| {
            AppError::Database(format!("read screenshot folder image row: {error}"))
        })
    }

    pub fn list_world_screenshots(
        &self,
        world_id: &str,
    ) -> Result<Vec<ScreenshotLibraryImage>, AppError> {
        let root_path = vrchat_paths::vrchat_photos_location();
        self.list_world_screenshots_for_root(&root_path, world_id)
    }

    fn list_world_screenshots_for_root(
        &self,
        root_path: &str,
        world_id: &str,
    ) -> Result<Vec<ScreenshotLibraryImage>, AppError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT path, folder_path, file_name, size_bytes, modified_at, created_at,
                    width, height, world_id, world_name, captured_at, error, metadata_json
             FROM screenshot_files
             WHERE scan_root = ?1 AND world_id = ?2
              ORDER BY file_name ASC, modified_at ASC",
            )
            .map_err(|error| AppError::Database(format!("prepare world screenshots: {error}")))?;
        let rows = stmt
            .query_map([root_path, world_id], Self::map_library_image_row)
            .map_err(|error| AppError::Database(format!("read world screenshots: {error}")))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| AppError::Database(format!("read world screenshot row: {error}")))
    }

    pub fn record_thumbnail_cache(
        &self,
        source_path: &str,
        thumb_path: &str,
        cache_key: &str,
        size_bytes: i64,
        modified_at: i64,
    ) {
        let conn = self.conn.lock().unwrap();
        let now = now_unix_seconds();
        let _ = conn.execute(
            "INSERT INTO screenshot_thumbnail_cache (
                thumb_path, source_path, cache_key, size_bytes, modified_at, created_at, last_used_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
             ON CONFLICT(thumb_path) DO UPDATE SET
                source_path = excluded.source_path,
                cache_key = excluded.cache_key,
                size_bytes = excluded.size_bytes,
                modified_at = excluded.modified_at,
                last_used_at = excluded.last_used_at",
            rusqlite::params![thumb_path, source_path, cache_key, size_bytes, modified_at, now],
        );
    }

    fn thumbnail_cache_entries(&self) -> Vec<ScreenshotThumbnailCacheEntry> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT thumb_path, source_path, cache_key, size_bytes, modified_at, last_used_at
             FROM screenshot_thumbnail_cache",
        ) {
            Ok(stmt) => stmt,
            Err(_) => return Vec::new(),
        };
        let entries = match stmt.query_map([], |row| {
            Ok(ScreenshotThumbnailCacheEntry {
                thumb_path: row.get(0)?,
                source_path: row.get(1)?,
                cache_key: row.get(2)?,
                size_bytes: row.get(3)?,
                modified_at: row.get(4)?,
                last_used_at: row.get(5)?,
            })
        }) {
            Ok(rows) => rows.filter_map(|row| row.ok()).collect(),
            Err(_) => Vec::new(),
        };
        entries
    }

    fn thumbnail_cache_entries_for_source(
        &self,
        source_path: &str,
    ) -> Vec<ScreenshotThumbnailCacheEntry> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT thumb_path, source_path, cache_key, size_bytes, modified_at, last_used_at
             FROM screenshot_thumbnail_cache
             WHERE source_path = ?1",
        ) {
            Ok(stmt) => stmt,
            Err(_) => return Vec::new(),
        };
        let entries = match stmt.query_map([source_path], |row| {
            Ok(ScreenshotThumbnailCacheEntry {
                thumb_path: row.get(0)?,
                source_path: row.get(1)?,
                cache_key: row.get(2)?,
                size_bytes: row.get(3)?,
                modified_at: row.get(4)?,
                last_used_at: row.get(5)?,
            })
        }) {
            Ok(rows) => rows.filter_map(|row| row.ok()).collect(),
            Err(_) => Vec::new(),
        };
        entries
    }

    fn thumbnail_last_used_map(&self) -> HashMap<String, i64> {
        self.thumbnail_cache_entries()
            .into_iter()
            .map(|entry| (entry.thumb_path, entry.last_used_at))
            .collect()
    }

    fn delete_thumbnail_cache_record(&self, thumb_path: &str) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "DELETE FROM screenshot_thumbnail_cache WHERE thumb_path = ?1",
            [thumb_path],
        );
    }

    pub fn clear_all(&self) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("DELETE FROM cache", []);
        let _ = conn.execute("DELETE FROM screenshot_files", []);
        let _ = conn.execute("DELETE FROM screenshot_thumbnail_cache", []);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new(name: &str) -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path =
                std::env::temp_dir().join(format!("vrcx-0-{name}-{}-{nonce}", std::process::id()));
            std::fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn write_test_png(path: &Path) -> Result<(), AppError> {
        write_test_png_with_size(path, 2, 2)
    }

    fn write_test_png_with_size(path: &Path, width: u32, height: u32) -> Result<(), AppError> {
        let img = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            width,
            height,
            image::Rgba([12, 34, 56, 255]),
        ));
        let mut buf = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut buf);
        img.write_with_encoder(encoder)
            .map_err(|e| AppError::Custom(format!("png encode: {e}")))?;
        std::fs::write(path, buf)?;
        Ok(())
    }

    fn write_text_chunk(path: &Path, keyword: &str, text: &str) -> Result<(), AppError> {
        let path_str = path.to_string_lossy();
        let mut png = png::PngFile::open_rw(&path_str)
            .map_err(|e| AppError::Custom(format!("png open: {e}")))?;
        let chunk = png::generate_text_chunk(keyword, text);
        assert!(png.write_chunk(&chunk));
        Ok(())
    }

    #[test]
    fn get_screenshot_metadata_reads_legacy_lfs_world_and_players_from_png() -> Result<(), AppError>
    {
        let dir = TestDir::new("screenshot-legacy-lfs");
        let path = dir.path.join("legacy.png");
        write_test_png(&path)?;
        write_text_chunk(
            &path,
            "Description",
            "lfs|2|author:usr_author,Ava|world:wrld_legacy,12345,Legacy World|pos:1.5,2.5,3.5|players:usr_one,1,2,3,Player One;usr_two,4.5,5.5,6.5,Player Two",
        )?;

        let path_str = path.to_string_lossy();
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(metadata.application.as_deref(), Some("lfs"));
        assert_eq!(metadata.world.id, "wrld_legacy");
        assert_eq!(metadata.world.name.as_deref(), Some("Legacy World"));
        assert_eq!(metadata.world.instance_id, "wrld_legacy:12345");
        assert_eq!(metadata.players.len(), 2);
        assert_eq!(metadata.players[0].id, "usr_one");
        assert_eq!(metadata.players[0].display_name, "Player One");
        assert_eq!(metadata.players[0].pos, Some([1.0, 2.0, 3.0]));
        assert_eq!(metadata.players[1].id, "usr_two");
        assert_eq!(metadata.players[1].display_name, "Player Two");
        assert_eq!(metadata.players[1].pos, Some([4.5, 5.5, 6.5]));
        Ok(())
    }

    #[test]
    fn add_screenshot_metadata_writes_vrcx_world_and_players_for_new_screenshot(
    ) -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-vrcx-metadata");
        let path = dir
            .path
            .join("VRChat_2026-05-08_00-00-00.000_3840x2160.png");
        write_test_png(&path)?;
        let path_str = path.to_string_lossy().into_owned();
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_new",
                "name": "New Screenshot World",
                "instanceId": "wrld_new:98765~region(us)"
            },
            "players": [
                {
                    "id": "usr_friend",
                    "displayName": "Friend One"
                }
            ]
        })
        .to_string();

        let written_path = add_screenshot_metadata(&path_str, &metadata_json, "wrld_new", false);
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(written_path, path_str);
        assert!(has_vrcx_metadata(&path_str));
        assert_eq!(metadata.application.as_deref(), Some("VRCX-0"));
        assert_eq!(metadata.world.id, "wrld_new");
        assert_eq!(metadata.world.name.as_deref(), Some("New Screenshot World"));
        assert_eq!(metadata.world.instance_id, "wrld_new:98765~region(us)");
        assert_eq!(metadata.players.len(), 1);
        assert_eq!(metadata.players[0].id, "usr_friend");
        assert_eq!(metadata.players[0].display_name, "Friend One");
        Ok(())
    }

    #[test]
    fn get_screenshot_metadata_merges_vrchat_world_name_with_vrcx_players() -> Result<(), AppError>
    {
        let dir = TestDir::new("screenshot-vrchat-vrcx-merge");
        let path = dir
            .path
            .join("VRChat_2026-05-08_00-00-01.000_3840x2160.png");
        write_test_png(&path)?;
        write_text_chunk(
            &path,
            "XML:com.adobe.xmp",
            r#"<x:xmpmeta xmlns:x="adobe:ns:meta/"><CreatorTool>VRChat</CreatorTool><Author>VRChat User</Author><AuthorID>usr_author</AuthorID><DateTime>2026-05-08T00:00:01.000Z</DateTime><WorldID>wrld_current</WorldID><WorldDisplayName>Current World Friends</WorldDisplayName></x:xmpmeta>"#,
        )?;
        let path_str = path.to_string_lossy().into_owned();
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_current",
                "name": "JSON World",
                "instanceId": "wrld_current:12345~hidden(usr_hidden)~region(us)"
            },
            "players": [
                {
                    "id": "usr_one",
                    "displayName": "Player One"
                },
                {
                    "id": "usr_two",
                    "displayName": "Player Two"
                }
            ]
        })
        .to_string();

        assert_eq!(
            add_screenshot_metadata(&path_str, &metadata_json, "wrld_current", false),
            path_str
        );
        let metadata = get_screenshot_metadata(&path_str).expect("metadata");

        assert_eq!(metadata.application.as_deref(), Some("VRChat"));
        assert_eq!(metadata.author.id, "usr_author");
        assert_eq!(metadata.author.display_name.as_deref(), Some("VRChat User"));
        assert_eq!(
            metadata.timestamp.as_deref(),
            Some("2026-05-08T00:00:01.000Z")
        );
        assert_eq!(metadata.world.id, "wrld_current");
        assert_eq!(
            metadata.world.name.as_deref(),
            Some("Current World Friends")
        );
        assert_eq!(
            metadata.world.instance_id,
            "wrld_current:12345~hidden(usr_hidden)~region(us)"
        );
        assert_eq!(
            metadata
                .players
                .iter()
                .map(|player| player.display_name.as_str())
                .collect::<Vec<_>>(),
            vec!["Player One", "Player Two"]
        );
        Ok(())
    }

    #[test]
    fn screenshot_library_scan_indexes_skips_and_deletes_png_files() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-library");
        let photos_dir = dir.path.join("photos");
        let nested_dir = photos_dir.join("nested");
        std::fs::create_dir_all(&nested_dir)?;
        let db_path = dir.path.join("metadataCache.db");
        let cache = MetadataCacheDb::new(&db_path).map_err(AppError::Custom)?;
        let image_path = nested_dir.join("VRChat_2026-05-08_00-00-02.000_3840x2160.png");
        write_test_png(&image_path)?;
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_library",
                "name": "Library World",
                "instanceId": "wrld_library:12345"
            },
            "players": [],
            "timestamp": "2026-05-08T00:00:02.000Z"
        })
        .to_string();
        write_text_chunk(&image_path, "Description", &metadata_json)?;

        let thumb_dir = dir.path.join("thumbs");
        let first_status = scan_screenshot_library_in(&photos_dir, &cache, Some(&thumb_dir), false);
        assert_eq!(first_status.scanned, 1);
        assert_eq!(first_status.indexed, 1);
        assert_eq!(first_status.changed, 1);
        assert_eq!(first_status.skipped, 0);
        assert_eq!(first_status.deleted, 0);
        assert_eq!(first_status.error, None);

        let folder_images = cache.list_screenshot_folder_images_for_root(
            &photos_dir.to_string_lossy(),
            &nested_dir.to_string_lossy(),
        )?;
        assert_eq!(folder_images.len(), 1);
        assert_eq!(
            folder_images[0].path,
            image_path.to_string_lossy().into_owned()
        );
        assert_eq!(folder_images[0].world_id.as_deref(), Some("wrld_library"));
        assert_eq!(
            folder_images[0].world_name.as_deref(),
            Some("Library World")
        );
        assert_eq!(folder_images[0].width, Some(2));
        assert_eq!(folder_images[0].height, Some(2));

        let world_images =
            cache.list_world_screenshots_for_root(&photos_dir.to_string_lossy(), "wrld_library")?;
        assert_eq!(world_images.len(), 1);
        assert_eq!(
            world_images[0].path,
            image_path.to_string_lossy().into_owned()
        );

        let image_path_string = image_path.to_string_lossy().into_owned();
        let thumb_path = ensure_screenshot_thumbnail_in_root(
            &image_path_string,
            &thumb_dir,
            &cache,
            &photos_dir,
        )?;
        assert!(Path::new(&thumb_path).is_file());

        let second_status =
            scan_screenshot_library_in(&photos_dir, &cache, Some(&thumb_dir), false);
        assert_eq!(second_status.scanned, 1);
        assert_eq!(second_status.indexed, 0);
        assert_eq!(second_status.changed, 0);
        assert_eq!(second_status.skipped, 1);
        assert_eq!(second_status.deleted, 0);

        std::fs::remove_file(&image_path)?;
        let third_status = scan_screenshot_library_in(&photos_dir, &cache, Some(&thumb_dir), false);
        assert_eq!(third_status.scanned, 0);
        assert_eq!(third_status.deleted, 1);
        assert!(cache
            .list_screenshot_folder_images_for_root(
                &photos_dir.to_string_lossy(),
                &nested_dir.to_string_lossy()
            )?
            .is_empty());
        assert!(cache
            .list_world_screenshots_for_root(&photos_dir.to_string_lossy(), "wrld_library")?
            .is_empty());
        assert!(!Path::new(&thumb_path).exists());
        Ok(())
    }

    #[test]
    fn screenshot_library_scan_repairs_stale_rows_without_metadata() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-library-stale-metadata");
        let photos_dir = dir.path.join("photos");
        std::fs::create_dir_all(&photos_dir)?;
        let db_path = dir.path.join("metadataCache.db");
        let cache = MetadataCacheDb::new(&db_path).map_err(AppError::Custom)?;
        let image_path = photos_dir.join("VRChat_2026-05-08_00-00-06.000_3840x2160.png");
        write_test_png(&image_path)?;
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_repaired",
                "name": "Repaired World",
                "instanceId": "wrld_repaired:12345"
            },
            "players": []
        })
        .to_string();
        write_text_chunk(&image_path, "Description", &metadata_json)?;

        let file_metadata = std::fs::metadata(&image_path)?;
        let modified_at = file_metadata
            .modified()
            .map(unix_time_millis)
            .unwrap_or_default();
        let image_path_string = image_path.to_string_lossy().into_owned();
        {
            let conn = cache.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO screenshot_files (
                    path, scan_root, folder_path, file_name, size_bytes, modified_at, indexed_at
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    image_path_string.as_str(),
                    photos_dir.to_string_lossy().as_ref(),
                    photos_dir.to_string_lossy().as_ref(),
                    "VRChat_2026-05-08_00-00-06.000_3840x2160.png",
                    file_metadata.len() as i64,
                    modified_at,
                    now_unix_seconds(),
                ],
            )
            .map_err(|error| AppError::Database(format!("seed stale row: {error}")))?;
        }

        let status = scan_screenshot_library_in(&photos_dir, &cache, None, false);
        assert_eq!(status.scanned, 1);
        assert_eq!(status.indexed, 1);
        assert_eq!(status.changed, 1);
        assert_eq!(status.skipped, 0);

        let folder_images = cache.list_screenshot_folder_images_for_root(
            &photos_dir.to_string_lossy(),
            &photos_dir.to_string_lossy(),
        )?;
        assert_eq!(folder_images.len(), 1);
        assert_eq!(
            folder_images[0].world_name.as_deref(),
            Some("Repaired World")
        );
        Ok(())
    }

    #[test]
    fn screenshot_library_queries_are_scoped_to_scan_root() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-library-root-scope");
        let root_a = dir.path.join("root-a");
        let root_b = dir.path.join("root-b");
        std::fs::create_dir_all(&root_a)?;
        std::fs::create_dir_all(&root_b)?;
        let cache =
            MetadataCacheDb::new(&dir.path.join("metadataCache.db")).map_err(AppError::Custom)?;
        let image_path = root_a.join("VRChat_2026-05-08_00-00-03.000_3840x2160.png");
        write_test_png(&image_path)?;
        let metadata_json = serde_json::json!({
            "application": "VRCX-0",
            "version": 1,
            "author": {
                "id": "usr_author",
                "displayName": "Ava"
            },
            "world": {
                "id": "wrld_scoped",
                "name": "Scoped World",
                "instanceId": "wrld_scoped:12345"
            },
            "players": []
        })
        .to_string();
        write_text_chunk(&image_path, "Description", &metadata_json)?;

        let status_a = scan_screenshot_library_in(&root_a, &cache, None, false);
        assert_eq!(status_a.indexed, 1);
        let status_b = scan_screenshot_library_in(&root_b, &cache, None, false);
        assert_eq!(status_b.scanned, 0);

        assert_eq!(
            cache
                .list_world_screenshots_for_root(&root_a.to_string_lossy(), "wrld_scoped")?
                .len(),
            1
        );
        assert!(cache
            .list_world_screenshots_for_root(&root_b.to_string_lossy(), "wrld_scoped")?
            .is_empty());
        assert!(cache
            .screenshot_folder_tree_for_root(&root_b.to_string_lossy())?
            .folders
            .iter()
            .all(|folder| folder.total_image_count == 0));
        Ok(())
    }

    #[test]
    fn ensure_screenshot_thumbnail_generates_and_reuses_webp_cache() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-thumbnail-cache");
        let cache =
            MetadataCacheDb::new(&dir.path.join("metadataCache.db")).map_err(AppError::Custom)?;
        let source_path = dir
            .path
            .join("VRChat_2026-05-08_00-00-04.000_3840x2160.png");
        let thumb_dir = dir.path.join("thumbs");
        write_test_png_with_size(&source_path, 64, 32)?;
        let source_path_string = source_path.to_string_lossy().into_owned();

        let first_thumb = ensure_screenshot_thumbnail_in_root(
            &source_path_string,
            &thumb_dir,
            &cache,
            &dir.path,
        )?;
        assert!(Path::new(&first_thumb).is_file());
        assert!(first_thumb.ends_with(".webp"));

        let second_thumb = ensure_screenshot_thumbnail_in_root(
            &source_path_string,
            &thumb_dir,
            &cache,
            &dir.path,
        )?;
        assert_eq!(first_thumb, second_thumb);

        write_test_png_with_size(&source_path, 65, 32)?;
        let third_thumb = ensure_screenshot_thumbnail_in_root(
            &source_path_string,
            &thumb_dir,
            &cache,
            &dir.path,
        )?;
        assert!(Path::new(&third_thumb).is_file());
        assert_ne!(first_thumb, third_thumb);
        assert!(!Path::new(&first_thumb).exists());
        Ok(())
    }

    #[test]
    fn ensure_screenshot_thumbnail_rejects_sources_outside_root() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-thumbnail-root");
        let cache =
            MetadataCacheDb::new(&dir.path.join("metadataCache.db")).map_err(AppError::Custom)?;
        let source_root = dir.path.join("photos");
        let outside_root = dir.path.join("outside");
        let thumb_dir = dir.path.join("thumbs");
        std::fs::create_dir_all(&source_root)?;
        std::fs::create_dir_all(&outside_root)?;
        let outside_path = outside_root.join("VRChat_2026-05-08_00-00-05.000_3840x2160.png");
        write_test_png(&outside_path)?;

        let result = ensure_screenshot_thumbnail_in_root(
            &outside_path.to_string_lossy(),
            &thumb_dir,
            &cache,
            &source_root,
        );
        assert!(result.is_err());
        assert!(!thumb_dir.exists());
        Ok(())
    }

    #[test]
    fn is_path_inside_directory_rejects_sibling_paths() -> Result<(), AppError> {
        let dir = TestDir::new("screenshot-thumbnail-containment");
        let root = dir.path.join("thumbs");
        let sibling = dir.path.join("thumbs-sibling");
        std::fs::create_dir_all(&root)?;
        std::fs::create_dir_all(&sibling)?;
        let inside = root.join("inside.webp");
        let outside = sibling.join("outside.webp");
        std::fs::write(&inside, b"webp")?;
        std::fs::write(&outside, b"webp")?;

        assert!(is_path_inside_directory(&inside, &root));
        assert!(!is_path_inside_directory(&outside, &root));
        Ok(())
    }
}
