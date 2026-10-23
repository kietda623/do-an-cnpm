import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { OrderQueryService } from "../services/order-query.service.js";

class OrderListQuery {
  @IsOptional()
  @IsIn(["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "COMPLETED", "CANCELLED"])
  status?: string;
  @IsOptional()
  @IsIn(["UNPAID", "PARTIALLY_PAID", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"])
  paymentStatus?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(AccessGuard)
export class OrdersController {
  constructor(private readonly orders: OrderQueryService) {}

  @Get()
  @ApiOperation({ summary: "List only the authenticated buyer's orders" })
  async list(@Req() req: ApiRequest, @Query() query: OrderListQuery) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return this.orders.list(userId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Read a buyer-owned order and immutable seller snapshots" })
  async get(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.orders.get(userId, id) };
  }
}
