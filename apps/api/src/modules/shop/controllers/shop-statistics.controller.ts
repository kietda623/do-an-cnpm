import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import type { AccessContext } from "../../../common/auth/access-context.js";
import type { ApiRequest } from "../../../common/http/request.types.js";
import { UtcDateRangeQueryDto } from "../../../common/http/utc-date.validator.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { ShopStatisticsService } from "../services/shop-statistics.service.js";

class DateRangeQuery extends UtcDateRangeQueryDto {}
class RevenueQuery extends DateRangeQuery {
  @IsIn(["DAY", "MONTH"]) groupBy!: "DAY" | "MONTH";
}

@ApiTags("shop-statistics")
@ApiBearerAuth("BearerAuth")
@UseGuards(AccessGuard)
@Controller("shops/:id")
export class ShopStatisticsController {
  constructor(private readonly reports: ShopStatisticsService) {}

  @Get("stats")
  @ApiQuery({ name: "from", required: false, format: "date-time" })
  @ApiQuery({ name: "to", required: false, format: "date-time" })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  async stats(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DateRangeQuery,
  ) {
    this.validateRange(query);
    return { data: await this.reports.stats(this.userId(req), id, query) };
  }

  @Get("revenue")
  @ApiQuery({ name: "from", required: false, format: "date-time" })
  @ApiQuery({ name: "to", required: false, format: "date-time" })
  @ApiQuery({ name: "groupBy", enum: ["DAY", "MONTH"], required: true })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  async revenue(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: RevenueQuery,
  ) {
    this.validateRange(query);
    return { data: await this.reports.revenue(this.userId(req), id, query) };
  }

  private userId(req: ApiRequest) {
    return currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
  }
  private validateRange(query: DateRangeQuery) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException({ code: "INVALID_DATE_RANGE" });
  }
}
