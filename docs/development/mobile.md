# Mobile API configuration

Set `EXPO_PUBLIC_API_URL` to the API base ending in `/api/v1` and set `APP_VARIANT` to `development` or `production`. No credentials or secrets belong in this URL or in the repository.

For an Android emulator, use `http://10.0.2.2:4000/api/v1` when the API runs on the host. For an Android device on the same network, use the host's LAN address, such as `http://192.168.1.20:4000/api/v1`. Local HTTP is accepted only when `APP_VARIANT=development` and `EXPO_ALLOW_HTTP=1`. Set `EXPO_PUBLIC_API_URL=https://<api-host>/api/v1` for HTTPS.

Production requires HTTPS; `EXPO_ALLOW_HTTP=1` does not enable cleartext traffic for production. Android native development/release builds, LAN-device testing, release-manifest HTTP blocking, and backup configuration remain acceptance items in T139; Expo Go is not evidence for those items.
