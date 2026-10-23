/** System-level roles are distinct from shop membership roles. */
export type SystemRole = "BUYER" | "ADMIN";

/**
 * Identity established by the authentication boundary after validating the
 * access token, active user, and active server-side session.
 *
 * Shop memberships are deliberately resolved by ResourcePolicy for each
 * requested shop rather than trusted from client-supplied context.
 */
export interface AccessContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly systemRole: SystemRole;
  readonly authVersion: number;
}

/** Nest injection token for the authentication implementation. */
export const ACCESS_CONTEXT_PROVIDER = Symbol("ACCESS_CONTEXT_PROVIDER");

/** Public boundary used by controllers and application services. */
export interface AccessContextProvider {
  requireCurrent(): AccessContext;
}
