use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: String,
    pub repo_url: &'static str,
    pub git_commit: &'static str,
    pub git_branch: &'static str,
}

#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: "PrimeClip",
        version: app.package_info().version.to_string(),
        repo_url: env!("GIT_REPO_URL"),
        git_commit: env!("GIT_COMMIT"),
        git_branch: env!("GIT_BRANCH"),
    }
}
