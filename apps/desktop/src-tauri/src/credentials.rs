use keyring::Entry;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::state::SidecarState;

const SERVICE: &str = "primeclip";

pub fn store_api_key(kind: &str, key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, kind).map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| e.to_string())
}

pub fn get_api_key(kind: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, kind).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_api_key(kind: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, kind).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn list_configured_providers() -> Result<Vec<String>, String> {
    let kinds = ["claude", "openai", "openrouter", "custom", "gemini"];
    let mut configured = Vec::new();
    for kind in kinds {
        if get_api_key(kind)?.is_some() {
            configured.push(kind.to_string());
        }
    }
    Ok(configured)
}

#[tauri::command]
pub fn store_api_key_cmd(kind: String, key: String) -> Result<(), String> {
    store_api_key(&kind, &key)
}

#[tauri::command]
pub fn get_api_key_cmd(kind: String) -> Result<Option<String>, String> {
    get_api_key(&kind)
}

#[tauri::command]
pub fn delete_api_key_cmd(kind: String) -> Result<(), String> {
    delete_api_key(&kind)
}

#[tauri::command]
pub fn list_configured_providers_cmd() -> Result<Vec<String>, String> {
    list_configured_providers()
}

#[tauri::command]
pub fn get_api_base_url(state: tauri::State<'_, SidecarState>) -> String {
    state.api_base_url.clone()
}

#[tauri::command]
pub fn get_bundle_profile() -> String {
    if cfg!(feature = "bundle-full") {
        "full".to_string()
    } else {
        std::env::var("BUNDLE_PROFILE").unwrap_or_else(|_| "lite".to_string())
    }
}

#[tauri::command]
pub async fn open_output_folder(path: String, app: AppHandle) -> Result<(), String> {
    app.shell()
        .open(path, None)
        .map_err(|e| e.to_string())
}
