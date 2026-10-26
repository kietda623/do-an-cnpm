import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessContext } from "../../common/auth/access-context.js";
import {
  ADMIN_PERMISSION_METADATA,
  hasAdminPermission,
  type AdminPermission,
} from "../../common/auth/permissions.js";
import type { ApiRequest } from "../../common/http/request.types.js";
import { currentAccessContext } from "../identity/access.guard.js";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ApiRequest & { accessContext?: AccessContext }>();
    const permission = this.reflector.getAllAndOverride<AdminPermission>(
      ADMIN_PERMISSION_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!hasAdminPermission(currentAccessContext(request).systemRole, permission)) {
      throw new ForbiddenException({
        code: "ADMIN_REQUIRED",
        message: "Administrator access is required.",
      });
    }
    return true;
  }
}
