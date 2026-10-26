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
  ApiTags,
} from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  isUUID,
} from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { OrderQueryService } from "../services/order-query.service.js";
import { FulfillmentService } from "../services/fulfillment.service.js";

class ExpectedVersionDto {
  @IsInt() @Min(0) expectedVersion!: number;
}

class SellerOrderListQuery {
  @IsOptional()
  @IsIn([
    "PENDING",
    "CONFIRMED",
    "PACKING",
    "SHIPPING",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ])
  status?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

@ApiTags("seller-orders")
@ApiBearerAuth()
@Controller("shops/:shopId/orders")
@UseGuards(AccessGuard)
export class SellerOrdersController {
  constructor(
    private readonly orders: OrderQueryService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List existing seller orders for a shop member" })
  list(
    @Req() req: ApiRequest,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Query() query: SellerOrderListQuery,
  ) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return this.orders.listSellerParts(userId, shopId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Read one seller order of a shop" })
  async get(
    @Req() req: ApiRequest,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.orders.getSellerPart(userId, shopId, id) };
  }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Confirm an existing seller order" })
  async confirm(
    @Req() req: ApiRequest,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ExpectedVersionDto,
  ) {
    this.requireKey(key);
    const userId = this.userId(req);
    await this.fulfillment.confirm(
      userId,
      shopId,
      id,
      key,
      body.expectedVersion,
    );
    return { data: await this.orders.getSellerPart(userId, shopId, id) };
  }

  @Post(":id/pack")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Pack an existing seller order and create its shipment",
  })
  async pack(
    @Req() req: ApiRequest,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ExpectedVersionDto,
  ) {
    this.requireKey(key);
    const userId = this.userId(req);
    await this.fulfillment.pack(userId, shopId, id, key, body.expectedVersion);
    return { data: await this.orders.getSellerPart(userId, shopId, id) };
  }

  private userId(req: ApiRequest) {
    return currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
  }

  private requireKey(key: string | undefined): asserts key is string {
    if (!isUUID(key))
      throw new BadRequestException({ code: "INVALID_IDEMPOTENCY_KEY" });
  }
}
