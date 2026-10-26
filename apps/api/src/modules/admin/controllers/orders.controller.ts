import { Type } from "class-transformer";
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  IsIn,
  IsInt,
  IsISO8601,
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
import { OrderInquiryService } from "../services/order-inquiry.service.js";

const orderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PACKING",
  "SHIPPING",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];
class AdminOrderListQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  buyerId?: string;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  shopId?: string;
  @ApiPropertyOptional({ enum: orderStatuses })
  @IsOptional()
  @IsIn(orderStatuses)
  status?: string;
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
@Controller("admin/orders")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("viewAllOrders")
export class AdminOrdersController {
  constructor(private readonly inquiry: OrderInquiryService) {}

  @Get()
  @ApiOperation({
    summary: "Search all orders without mutating transaction data",
  })
  list(@Query() query: AdminOrderListQuery) {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "from must be earlier than to.",
      });
    return this.inquiry.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Read an order and its audit references" })
  async get(@Param("id", new ParseUUIDPipe()) id: string) {
    return { data: await this.inquiry.get(id) };
  }
}
