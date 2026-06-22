use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;

const APP_NAME: &str = "PrimeClip";
const REPO_URL: &str = env!("GIT_REPO_URL");

pub fn setup_menu(app: &App) -> tauri::Result<()> {
    let version = app.package_info().version.to_string();
    let git_commit = env!("GIT_COMMIT");
    let git_branch = env!("GIT_BRANCH");

    let settings = MenuItemBuilder::with_id("settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let help_guide = MenuItemBuilder::with_id("help", "PrimeClip Help")
        .accelerator("CmdOrCtrl+?")
        .build(app)?;

    let open_repo = MenuItemBuilder::with_id("open-repo", "View on GitHub")
        .build(app)?;

    let app_submenu = SubmenuBuilder::new(app, APP_NAME)
        .about(Some(AboutMetadata {
            name: Some(APP_NAME.into()),
            version: Some(version.clone()),
            short_version: Some(version),
            authors: Some(vec!["PrimeClip Contributors".into()]),
            comments: Some(format!(
                "Local-first AI video clipping for Shorts, Reels, and TikTok.\n\nSource: {REPO_URL}\nBranch: {git_branch}\nCommit: {git_commit}"
            )),
            copyright: Some("Copyright © PrimeClip Contributors".into()),
            license: Some("MIT".into()),
            website: Some(REPO_URL.into()),
            website_label: Some("GitHub Repository".into()),
            credits: Some(format!("Built from {git_branch}@{git_commit}")),
            ..Default::default()
        }))
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&help_guide)
        .item(&open_repo)
        .build()?;

    #[cfg(target_os = "macos")]
    help_submenu.set_as_help_menu_for_nsapp()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_submenu, &edit_submenu, &help_submenu])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

pub fn attach_menu_handlers(app: &AppHandle) {
    app.on_menu_event(move |app, event| {
        match event.id().0.as_str() {
            "settings" => emit_navigate(app, "/settings"),
            "help" => emit_navigate(app, "/help"),
            "open-repo" => {
                let _ = app.shell().open(REPO_URL, None);
            }
            _ => {}
        }
    });
}

fn emit_navigate(app: &AppHandle, path: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("menu-navigate", path);
    }
}
