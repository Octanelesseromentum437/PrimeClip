use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

pub struct SidecarManager {
    pub child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    pub port: u16,
}

impl SidecarManager {
    pub fn new(port: u16) -> Self {
        Self {
            child: Mutex::new(None),
            port,
        }
    }

    pub fn api_base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    pub fn spawn_sidecar(&self, app: &AppHandle) -> Result<(), String> {
        let sidecar = app
            .shell()
            .sidecar("primeclip-api")
            .map_err(|e| e.to_string())?;

        let (mut rx, child) = sidecar
            .env("SIDECAR_PORT", self.port.to_string())
            .spawn()
            .map_err(|e| e.to_string())?;

        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let tauri_plugin_shell::process::CommandEvent::Error(e) = event {
                    eprintln!("sidecar error: {e}");
                }
            }
        });

        *self.child.lock().unwrap() = Some(child);
        Ok(())
    }

    pub fn kill(&self) {
        if let Some(child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.kill();
    }
}

pub fn wait_for_api(base_url: &str) -> bool {
    for _ in 0..30 {
        if health_check(base_url).is_ok() {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    false
}

fn health_check(url: &str) -> Result<(), ()> {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    let url = url.trim_start_matches("http://");
    let (host_port, path) = url.split_once('/').unwrap_or((url, "api/health"));
    let mut stream = TcpStream::connect(host_port).map_err(|_| ())?;
    let req = format!("GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nConnection: close\r\n\r\n");
    stream.write_all(req.as_bytes()).map_err(|_| ())?;
    let mut buf = [0u8; 256];
    let n = stream.read(&mut buf).map_err(|_| ())?;
    let resp = String::from_utf8_lossy(&buf[..n]);
    if resp.contains("200") {
        Ok(())
    } else {
        Err(())
    }
}
