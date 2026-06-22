fn git_output(args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn git_commit() -> String {
    git_output(&["rev-parse", "--short", "HEAD"]).unwrap_or_else(|| "unknown".into())
}

fn git_branch() -> String {
    git_output(&["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|| "unknown".into())
}

fn git_remote_url() -> String {
    git_output(&["remote", "get-url", "origin"])
        .map(normalize_git_remote_url)
        .unwrap_or_else(|| "https://github.com/lucianodiisouza/PrimeClip".into())
}

fn normalize_git_remote_url(remote: String) -> String {
    if remote.starts_with("git@") {
        let without_prefix = remote.trim_start_matches("git@");
        if let Some((host, path)) = without_prefix.split_once(':') {
            let path = path.trim_end_matches(".git");
            return format!("https://{host}/{path}");
        }
    }
    remote.trim_end_matches(".git").to_string()
}

fn main() {
    println!("cargo:rerun-if-changed=../../../.git/HEAD");
    println!("cargo:rerun-if-changed=../../../.git/refs/heads");
    println!("cargo:rustc-env=GIT_COMMIT={}", git_commit());
    println!("cargo:rustc-env=GIT_BRANCH={}", git_branch());
    println!("cargo:rustc-env=GIT_REPO_URL={}", git_remote_url());
    tauri_build::build()
}
