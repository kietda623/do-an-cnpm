import type { ReactNode } from "react";

export { SessionProvider, useSession } from "./auth/session-provider";
export { RoleGate } from "./auth/role-gate";
export type { SessionUser } from "./auth/session-provider";

export { ApiProvider, useApi } from "./api/api-provider";
export type { ApiContextValue, AuthStatus } from "./api/api-provider";

export * from "./lib/cx";
export * from "./lib/format";
export * from "./lib/status";

export * from "./icons";

export * from "./primitives/button";
export * from "./primitives/badge";
export * from "./primitives/field";
export * from "./primitives/surface";
export * from "./primitives/data-table";
export * from "./primitives/dialog";
export * from "./primitives/toast";

export * from "./charts/charts";
export * from "./shell/storefront-shell";
export * from "./shell/console-shell";

export function FormSection({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="mp-form-section" aria-label={title} data-slot="form-section">
      {title && <h2 className="mp-form-section__title">{title}</h2>}
      {children}
    </section>
  );
}
