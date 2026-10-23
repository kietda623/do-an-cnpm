import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AccessContext } from "../../common/auth/access-context.js";
import { AuthService } from "./identity.service.js";

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; accessContext?: AccessContext }>();
    const header = request.headers.authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new UnauthorizedException();
    request.accessContext = await this.auth.accessContext(match[1]!);
    return true;
  }
}

export function currentAccessContext(request: { accessContext?: AccessContext }): AccessContext {
  if (!request.accessContext) throw new UnauthorizedException();
  return request.accessContext;
}
