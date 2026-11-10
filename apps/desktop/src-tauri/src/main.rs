use marketplace_desktop::navigation::is_allowed_navigation;
use tauri::webview::NewWindowResponse;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use url::Url;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let storefront_url = option_env!("DESKTOP_STOREFRONT_URL").ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "DESKTOP_STOREFRONT_URL must be validated by the desktop launcher",
                )
            })?;
            let storefront_url = Url::parse(storefront_url)?;
            let is_dev = cfg!(debug_assertions);
            if !is_allowed_navigation(&storefront_url, &storefront_url, is_dev) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "the configured storefront URL is not allowed",
                )
                .into());
            }

            let allowed_origin = storefront_url.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(storefront_url))
                .title("Marketplace")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .on_navigation(move |candidate| {
                    is_allowed_navigation(candidate, &allowed_origin, is_dev)
                })
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Marketplace desktop");
}
