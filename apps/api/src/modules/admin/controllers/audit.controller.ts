import { Type } from "class-transformer";
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { RequireAdminPermission } from "../../../common/auth/permissions.js";
import { AccessGuard } from "../../identity/access.guard.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import { AuditQueryService } from "../services/audit-query.service.js";

class AdminAuditQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  resourceId?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  actorId?: string;
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  from?: string;
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  to?: string;
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

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/audit")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("viewAudit")
export class AdminAuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @ApiOperation({ summary: "Search immutable sanitized audit events" })
  list(@Query() query: AdminAuditQuery) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "from must be earlier than to.",
      });
    return this.audit.list(query);
  }
}
