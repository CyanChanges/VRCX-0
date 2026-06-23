// Modified from https://github.com/pfernie/reqwest_cookie_store/blob/c906d634bad35b9f79abdc36f939979e39d1a2e1/src/lib.rs
// Original code licensed under MIT

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use cookie_store::{Cookie, CookieStore, RawCookie, RawCookieParseError};
use reqwest::header::HeaderValue;
use tokio_tungstenite::tungstenite::Bytes;
use url::Url;

pub struct CookieJarInner {
    dirty: bool,
    store: CookieStore,
}

pub struct CookieJar(std::sync::Mutex<CookieJarInner>);

impl CookieJar {
    pub fn new(store: CookieStore) -> Self {
        Self(std::sync::Mutex::new(CookieJarInner {
            dirty: false,
            store,
        }))
    }

    pub fn has_changed(&self) -> bool {
        self.0.lock().unwrap().dirty
    }

    pub fn with_snapshot_if_dirty<F, R>(&self, closure: F, is_flush: bool) -> Option<R>
    where
        F: FnOnce(&CookieStore) -> R,
    {
        self.map(|inner| {
            inner.dirty.then(|| {
                if is_flush {
                    inner.dirty = false;
                }
                closure(&inner.store)
            })
        })
    }

    pub fn read_with<F, R>(&self, closure: F) -> R
    where
        F: FnOnce(&CookieStore) -> R,
    {
        self.map(|inner| closure(&inner.store))
    }

    pub fn update<F, R>(&self, closure: F) -> R
    where
        F: FnOnce(&mut CookieStore) -> R,
    {
        self.map(|inner| {
            inner.dirty = true;
            closure(&mut inner.store)
        })
    }

    pub fn map<F, R>(&self, closure: F) -> R
    where
        F: FnOnce(&mut CookieJarInner) -> R,
    {
        let mut guard = self.0.lock().unwrap();
        closure(&mut guard)
    }

    pub fn into_inner(self) -> (bool, CookieStore) {
        let inner = self.0.into_inner().unwrap();
        (inner.dirty, inner.store)
    }
}

impl reqwest::cookie::CookieStore for CookieJar {
    fn set_cookies(&self, cookie_headers: &mut dyn Iterator<Item = &HeaderValue>, url: &Url) {
        let mut guard = self.0.lock().unwrap();
        guard.dirty = true;
        set_cookies(&mut guard.store, cookie_headers, url);
    }

    fn cookies(&self, url: &Url) -> Option<HeaderValue> {
        let guard = self.0.lock().unwrap();
        let s = guard
            .store
            .get_request_values(url)
            .map(|(name, value)| format!("{}={}", name, value))
            .collect::<Vec<_>>()
            .join("; ");

        if s.is_empty() {
            return None;
        }

        HeaderValue::from_maybe_shared(Bytes::from(s)).ok()
    }
}

fn set_cookies(
    cookie_store: &mut CookieStore,
    cookie_headers: &mut dyn Iterator<Item = &HeaderValue>,
    url: &Url,
) {
    let cookies = cookie_headers.filter_map(|val| {
        std::str::from_utf8(val.as_bytes())
            .map_err(RawCookieParseError::from)
            .and_then(RawCookie::parse)
            .map(|c| c.into_owned())
            .ok()
    });
    cookie_store.store_response_cookies(cookies, url);
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct CookieEntry {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
}

pub fn serialize_cookie_store(store: &CookieStore) -> Option<String> {
    let mut json = Vec::new();
    #[allow(deprecated)]
    store
        .save_incl_expired_and_nonpersistent_json(&mut json)
        .ok()?;
    Some(B64.encode(json))
}

pub fn deserialize_cookie_store(b64: &str) -> Option<CookieStore> {
    let bytes = B64.decode(b64).ok()?;
    #[allow(deprecated)]
    CookieStore::load_json_all(&*bytes).ok()
}

pub fn deserialize_legacy_cookie_entries(b64: &str) -> Option<Vec<CookieEntry>> {
    let bytes = B64.decode(b64).ok()?;
    serde_json::from_slice::<Vec<CookieEntry>>(&bytes).ok()
}
