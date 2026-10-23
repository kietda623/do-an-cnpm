import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AccessContext } from "../../common/auth/access-context.js";
import type { ApiRequest } from "../../common/http/request.types.js";
import { currentAccessContext } from "../identity/access.guard.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ApiRequest & { accessContext?: AccessContext }>();
    if (currentAccessContext(request).systemRole !== "ADMIN") {
      throw new ForbiddenException({
        code: "ADMIN_REQUIRED",
        message: "Administrator access is required.",
      });
    }
    return true;
  }
}
