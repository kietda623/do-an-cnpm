import { Type } from "class-transformer";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  isUUID,
} from "class-validator";
import { RequireAdminPermission } from "../../../common/auth/permissions.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import type { ApiRequest } from "../../../common/http/request.types.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import { AccountManagementService } from "../services/account-management.service.js";

class UserListQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional({ enum: ["ACTIVE", "LOCKED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "LOCKED"])
  status?: "ACTIVE" | "LOCKED";
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

class ReasonVersionDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/users")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("accessAdmin")
export class AdminUsersController {
  constructor(private readonly accounts: AccountManagementService) {}

  @Get()
  @RequireAdminPermission("accessAdmin")
  @ApiOperation({ summary: "Search marketplace user accounts" })
  list(@Query() query: UserListQuery) {
    return this.accounts.list(query);
  }

  @Post(":id/lock")
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission("lockUser")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Lock an account and revoke active sessions" })
  async lock(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ReasonVersionDto,
  ) {
    this.requireKey(key);
    const context = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
    return {
      data: await this.accounts.lock(
        context.userId,
        id,
        key,
        body,
        req.requestId,
      ),
    };
  }

  @Post(":id/unlock")
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission("lockUser")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Unlock an account without restoring revoked sessions",
  })
  async unlock(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ReasonVersionDto,
  ) {
    this.requireKey(key);
    const context = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
    return {
      data: await this.accounts.unlock(
        context.userId,
        id,
        key,
        body,
        req.requestId,
      ),
    };
  }

  private requireKey(key: string | undefined): asserts key is string {
    if (!isUUID(key))
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a UUID.",
      });
  }
}
