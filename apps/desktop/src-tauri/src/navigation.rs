use url::{Host, Url};

fn is_explicit_dev_host(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(host)) => host == "localhost",
        Some(Host::Ipv4(address)) => address == std::net::Ipv4Addr::LOCALHOST,
        _ => false,
    }
}

pub fn is_allowed_navigation(candidate: &Url, storefront_origin: &Url, is_dev: bool) -> bool {
    if !candidate.username().is_empty()
        || candidate.password().is_some()
        || !storefront_origin.username().is_empty()
        || storefront_origin.password().is_some()
    {
        return false;
    }

    let local_development_origin = is_dev
        && storefront_origin.scheme() == "http"
        && is_explicit_dev_host(storefront_origin)
        && storefront_origin.port() == Some(3000);
    if !local_development_origin {
        return false;
    }
    if candidate.scheme() != storefront_origin.scheme() {
        return false;
    }

    candidate.origin() == storefront_origin.origin()
}

#[cfg(test)]
mod tests {
    use super::is_allowed_navigation;
    use url::Url;

    fn parse(value: &str) -> Url {
        Url::parse(value).expect("test URL should parse")
    }

    #[test]
    fn rejects_remote_storefront_origins_for_the_local_demo() {
        let storefront = parse("https://shop.example.test/");
        assert!(!is_allowed_navigation(
            &parse("https://shop.example.test/orders/42"),
            &storefront,
            false,
        ));
    }

    #[test]
    fn rejects_http_other_hosts_lookalikes_ports_credentials_and_other_schemes() {
        let storefront = parse("https://shop.example.test/");
        for value in [
            "http://shop.example.test/",
            "https://other.example.test/",
            "https://shop.example.test.evil.test/",
            "https://shop.example.test:8443/",
            "https://user:pass@shop.example.test/",
            "https://[::1]/",
            "https://[::ffff:127.0.0.1]/",
            "http://127.0.0.2:3000/",
            "tauri://localhost/",
            "javascript:alert(1)",
        ] {
            assert!(
                !is_allowed_navigation(&parse(value), &storefront, false),
                "unexpectedly allowed {value}",
            );
        }
        assert!(!is_allowed_navigation(
            &parse("https://shop.example.test:8443/"),
            &parse("https://shop.example.test:8443/"),
            false,
        ));
        assert!(!is_allowed_navigation(
            &parse("https://[::1]/"),
            &parse("https://[::1]/"),
            false,
        ));
        assert!(!is_allowed_navigation(
            &parse("https://[::ffff:127.0.0.1]/"),
            &parse("https://[::ffff:127.0.0.1]/"),
            false,
        ));
    }

    #[test]
    fn allows_only_the_configured_local_http_origin_in_development() {
        let storefront = parse("http://localhost:3000/");
        assert!(is_allowed_navigation(
            &parse("http://localhost:3000/products/sku"),
            &storefront,
            true,
        ));
        let ipv4_storefront = parse("http://127.0.0.1:3000/");
        assert!(is_allowed_navigation(
            &parse("http://127.0.0.1:3000/products/sku"),
            &ipv4_storefront,
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("http://localhost:3001/"),
            &storefront,
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("http://127.0.0.1:3000/"),
            &storefront,
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("https://localhost:3000/"),
            &storefront,
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("http://localhost:3001/path"),
            &parse("http://localhost:3001/"),
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("http://localhost:80/"),
            &parse("http://localhost/"),
            true,
        ));
        assert!(!is_allowed_navigation(
            &parse("https://shop.example.test/products"),
            &parse("https://shop.example.test/"),
            true,
        ));
    }
}
