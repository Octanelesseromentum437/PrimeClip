mod app_info;
mod credentials;
mod icon_shape;
mod menu;
mod sidecar;
mod state;

use app_info::get_app_info;
use icon_shape::set_icon_shape;
use credentials::{
    delete_api_key_cmd, delete_google_tokens_cmd, get_api_base_url, get_api_key_cmd,
    get_bundle_profile, get_google_access_token_cmd, list_configured_providers_cmd,
    open_output_folder, store_api_key_cmd, store_google_tokens_cmd,
};
use sidecar::{SidecarManager, wait_for_api};
use state::SidecarState;
use tauri::{Emitter, Manager};

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
                // PyInstaller onefile sidecar can take 30–90s on cold start; don't block the window.
                let app_handle = app.handle().clone();
                let wait_url = base_url.clone();
                std::thread::spawn(move || {
                    if wait_for_api(&wait_url) {
                        let _ = app_handle.emit("api-ready", ());
                    } else {
                        eprintln!("Warning: sidecar health check timed out");
                        let _ = app_handle.emit("api-startup-failed", ());
                    }
                });
            }

            app.manage(SidecarState {
                api_base_url: base_url,
            });
            app.manage(manager);

            menu::setup_menu(app)?;
            menu::attach_menu_handlers(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
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
            set_icon_shape,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
