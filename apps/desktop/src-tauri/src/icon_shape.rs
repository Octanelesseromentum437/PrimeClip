use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IconShape {
    Square,
    Rounded,
    Circle,
}

impl IconShape {
    pub fn parse(value: &str) -> Self {
        match value {
            "square" => Self::Square,
            "circle" => Self::Circle,
            _ => Self::Rounded,
        }
    }

    fn bytes(self) -> &'static [u8] {
        match self {
            Self::Square => include_bytes!("../icons/variants/square.png"),
            Self::Rounded => include_bytes!("../icons/variants/rounded.png"),
            Self::Circle => include_bytes!("../icons/variants/circle.png"),
        }
    }
}

fn image_from_bytes(bytes: &[u8]) -> Result<tauri::image::Image<'static>, String> {
    tauri::image::Image::from_bytes(bytes)
        .map(|image| image.to_owned())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn set_dock_icon(bytes: &[u8]) -> Result<(), String> {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let app = NSApplication::sharedApplication(mtm);
    let data = NSData::with_bytes(bytes);
    let app_icon = NSImage::initWithData(NSImage::alloc(), &data)
        .ok_or_else(|| "Failed to decode icon image".to_string())?;
    unsafe { app.setApplicationIconImage(Some(&app_icon)) };
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn set_dock_icon(_bytes: &[u8]) -> Result<(), String> {
    Ok(())
}

fn set_window_icons(app: &AppHandle, image: tauri::image::Image<'static>) -> Result<(), String> {
    for (_, window) in app.webview_windows() {
        window
            .set_icon(image.clone())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(target_os = "macos", allow(unused_variables))]
pub fn apply_icon_shape(app: &AppHandle, shape: IconShape) -> Result<(), String> {
    let bytes = shape.bytes();

    #[cfg(target_os = "macos")]
    set_dock_icon(bytes)?;

    #[cfg(not(target_os = "macos"))]
    {
        let image = image_from_bytes(bytes)?;
        set_window_icons(app, image)?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_icon_shape(app: AppHandle, shape: String) -> Result<(), String> {
    apply_icon_shape(&app, IconShape::parse(&shape))
}
