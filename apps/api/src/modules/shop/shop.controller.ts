import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { ApiRequest } from "../../common/http/request.types.js";
import { RequireAdminPermission } from "../../common/auth/permissions.js";
import type { AccessContext } from "../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../identity/access.guard.js";
import { AdminGuard } from "./admin.guard.js";
import { ShopService } from "./shop.service.js";

const shopStatuses = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"] as const;

class ShopWriteDto {
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsString() @MinLength(3) @MaxLength(80) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MinLength(1) @MaxLength(5000) description!: string;
  @IsUUID() logoAssetId!: string;
  @IsString() @MinLength(1) @MaxLength(500) contactAddress!: string;
  @IsString() @MinLength(8) @MaxLength(20) phone!: string;
}

class ShopPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) name?: string;
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  slug?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(5000) description?: string;
  @IsOptional() @IsUUID() logoAssetId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) contactAddress?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsOptional() @IsUUID() bannerAssetId?: string | null;
  @IsInt() @Min(0) expectedVersion!: number;
}

class ExpectedVersionDto {
  @IsInt() @Min(0) expectedVersion!: number;
}

class ReasonVersionDto extends ExpectedVersionDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}

class ShopListQueryDto {
  @IsOptional() @IsIn(shopStatuses) status?: (typeof shopStatuses)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

@ApiTags("shops")
@Controller()
export class ShopController {
  constructor(private readonly shops: ShopService) {}

  @Get("users/me/shops")
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current user's active shop memberships" })
  async memberships(@Req() req: ApiRequest) {
    return { data: await this.shops.memberships(this.context(req).userId) };
  }

  @Post("shops")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a shop and its owner membership" })
  async create(@Req() req: ApiRequest, @Body() body: ShopWriteDto) {
    return { data: await this.shops.create(this.context(req).userId, body) };
  }

  @Get("shops/:id")
  @ApiOperation({ summary: "Get an active public shop profile" })
  async publicShop(@Param("id") id: string) {
    return { data: await this.shops.publicShop(id) };
  }

  @Get("shops/:id/management")
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a shop management profile" })
  async management(@Req() req: ApiRequest, @Param("id") id: string) {
    return { data: await this.shops.management(this.context(req).userId, id) };
  }

  @Patch("shops/:id")
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a shop profile using optimistic versioning" })
  async patch(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: ShopPatchDto) {
    return { data: await this.shops.patch(this.context(req).userId, id, body) };
  }

  @Post("shops/:id/resubmit")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Resubmit a rejected shop for review" })
  async resubmit(
    @Req() req: ApiRequest,
    @Param("id") id: string,
    @Body() body: ExpectedVersionDto,
  ) {
    return { data: await this.shops.resubmit(this.context(req).userId, id, body.expectedVersion) };
  }

  private context(req: ApiRequest): AccessContext {
    return currentAccessContext(req as ApiRequest & { accessContext?: AccessContext });
  }
}

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/shops")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("approveShop")
export class ShopModerationController {
  constructor(private readonly shops: ShopService) {}

  @Get()
  @ApiOperation({ summary: "List shops for moderation" })
  async list(@Query() query: ShopListQueryDto) {
    return this.shops.adminList(query);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve a pending shop" })
  async approve(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: ExpectedVersionDto) {
    return { data: await this.shops.moderate(this.context(req).userId, id, "approve", body) };
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a pending shop with a reason" })
  async reject(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: ReasonVersionDto) {
    return { data: await this.shops.moderate(this.context(req).userId, id, "reject", body) };
  }

  @Post(":id/suspend")
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission("suspendShop")
  @ApiOperation({ summary: "Suspend an active shop with a reason" })
  async suspend(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: ReasonVersionDto) {
    return { data: await this.shops.moderate(this.context(req).userId, id, "suspend", body) };
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  @RequireAdminPermission("suspendShop")
  @ApiOperation({ summary: "Resume a suspended shop" })
  async resume(@Req() req: ApiRequest, @Param("id") id: string, @Body() body: ReasonVersionDto) {
    return { data: await this.shops.moderate(this.context(req).userId, id, "resume", body) };
  }

  private context(req: ApiRequest): AccessContext {
    return currentAccessContext(req as ApiRequest & { accessContext?: AccessContext });
  }
}
