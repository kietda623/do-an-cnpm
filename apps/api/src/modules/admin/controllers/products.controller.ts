import { Transform, Type } from "class-transformer";
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
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
import { AdminModerationService } from "../services/moderation.service.js";

class ProductListQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  shopId?: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  adminHidden?: boolean;
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

class ProductHideDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/products")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("accessAdmin")
export class AdminProductsController {
  constructor(private readonly moderation: AdminModerationService) {}

  @Get()
  @ApiOperation({ summary: "List all products and moderation states" })
  list(@Query() query: ProductListQuery) {
    return this.moderation.listProducts(query);
  }

  @Post(":id/hide")
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission("hideProduct")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Hide a product from public discovery and checkout",
  })
  async hide(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ProductHideDto,
  ) {
    if (!isUUID(key))
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a UUID.",
      });
    const context = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
    const result = await this.moderation.hideProduct(
      context.userId,
      id,
      key,
      body,
      req.requestId,
    );
    return { data: result };
  }
}
