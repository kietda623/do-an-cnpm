import {
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
import {
  IsAfterFrom,
  IsUtcTimestamp,
} from "../../../common/http/utc-date.validator.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { ShopStatisticsService } from "../services/shop-statistics.service.js";

class DateRangeQuery {
  @IsUtcTimestamp() from!: string;
  @IsUtcTimestamp() @IsAfterFrom() to!: string;
}
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
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    format: "date-time",
    description: "Inclusive UTC timestamp.",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    format: "date-time",
    description: "Exclusive UTC timestamp; later than from.",
  })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  async stats(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DateRangeQuery,
  ) {
    return { data: await this.reports.stats(this.userId(req), id, query) };
  }

  @Get("revenue")
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    format: "date-time",
    description: "Inclusive UTC timestamp.",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    format: "date-time",
    description: "Exclusive UTC timestamp; later than from.",
  })
  @ApiQuery({ name: "groupBy", enum: ["DAY", "MONTH"], required: true })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  async revenue(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: RevenueQuery,
  ) {
    return { data: await this.reports.revenue(this.userId(req), id, query) };
  }

  private userId(req: ApiRequest) {
    return currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
  }
}
