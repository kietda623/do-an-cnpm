import type { AccessContext } from "./access-context.js";

export type ResourceReference =
  | { readonly kind: "USER"; readonly ownerUserId: string }
  | { readonly kind: "SHOP"; readonly shopId: string };

export type ResourceAction = string;

/**
 * Authorization boundary for resource ownership and shop membership.
 * Implementations must resolve current membership from trusted persistence;
 * callers must not derive authorization from IDs or roles in request payloads.
 */
export interface ResourcePolicy {
  assertAllowed(
    access: AccessContext,
    resource: ResourceReference,
    action: ResourceAction,
  ): Promise<void>;
}

/** Nest injection token for the authorization implementation. */
export const RESOURCE_POLICY = Symbol("RESOURCE_POLICY");
