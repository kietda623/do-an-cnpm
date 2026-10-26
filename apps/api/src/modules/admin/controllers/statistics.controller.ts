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
import { IsISO8601, IsOptional } from "class-validator";
import { RequireAdminPermission } from "../../../common/auth/permissions.js";
import { AccessGuard } from "../../identity/access.guard.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import { AdminStatisticsService } from "../services/admin-statistics.service.js";

class AdminStatsQuery {
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  from?: string;
  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/stats")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("viewPlatformStats")
export class AdminStatisticsController {
  constructor(private readonly stats: AdminStatisticsService) {}

  @Get()
  @ApiOperation({
    summary: "Read consistent platform counts and simulated completed sales",
  })
  async get(@Query() query: AdminStatsQuery) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "from must be earlier than to.",
      });
    return { data: await this.stats.get(query) };
  }
}
