mod credentials;
mod sidecar;
mod state;

use credentials::{
    delete_api_key_cmd, delete_google_tokens_cmd, get_api_base_url, get_api_key_cmd,
    get_bundle_profile, get_google_access_token_cmd, list_configured_providers_cmd,
    open_output_folder, store_api_key_cmd, store_google_tokens_cmd,
};
use sidecar::{SidecarManager, wait_for_api};
use state::SidecarState;
use tauri::Manager;

const DEFAULT_PORT: u16 = 8765;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let port = std::env::var("SIDECAR_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(DEFAULT_PORT);

            let manager = SidecarManager::new(port);
            let base_url = manager.api_base_url();

            #[cfg(not(debug_assertions))]
            {
                manager.spawn_sidecar(app.handle())?;
                if !wait_for_api(&base_url) {
                    eprintln!("Warning: sidecar health check timed out");
                }
            }

            app.manage(SidecarState {
                api_base_url: base_url,
            });
            app.manage(manager);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            store_api_key_cmd,
            get_api_key_cmd,
            delete_api_key_cmd,
            list_configured_providers_cmd,
            store_google_tokens_cmd,
            get_google_access_token_cmd,
            delete_google_tokens_cmd,
            get_api_base_url,
            get_bundle_profile,
            open_output_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
