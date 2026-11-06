import type { ConfigService } from "@nestjs/config";

export function allowedBrowserOrigins(config: ConfigService): Set<string> {
  const origins = new Set(
    (config.get<string>("CORS_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  if (config.get<string>("NODE_ENV") === "development") {
    for (const port of [3000, 3001, 3002]) {
      const localhost = `http://localhost:${port}`;
      const loopback = `http://127.0.0.1:${port}`;
      if (origins.has(localhost) || origins.has(loopback)) {
        origins.add(localhost);
        origins.add(loopback);
      }
    }
  }
  return origins;
}
