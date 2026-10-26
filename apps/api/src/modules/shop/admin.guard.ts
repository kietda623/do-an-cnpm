import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { AccessContext } from "../../common/auth/access-context.js";
import { isAdmin } from "../../common/auth/permissions.js";
import type { ApiRequest } from "../../common/http/request.types.js";
import { currentAccessContext } from "../identity/access.guard.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ApiRequest & { accessContext?: AccessContext }>();
    if (!isAdmin(currentAccessContext(request).systemRole)) {
      throw new ForbiddenException({
        code: "ADMIN_REQUIRED",
        message: "Administrator access is required.",
      });
    }
    return true;
  }
}
