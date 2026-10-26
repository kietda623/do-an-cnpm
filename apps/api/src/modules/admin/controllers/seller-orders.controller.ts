import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  isUUID,
} from "class-validator";
import type { AccessContext } from "../../../common/auth/access-context.js";
import type { ApiRequest } from "../../../common/http/request.types.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { OrderQueryService } from "../../order/services/order-query.service.js";
import { FulfillmentService } from "../../order/services/fulfillment.service.js";

class AdminSellerOrderActionDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/seller-orders")
@UseGuards(AccessGuard, AdminGuard)
export class AdminSellerOrdersController {
  constructor(
    private readonly orders: OrderQueryService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Confirm a seller order for a locked Seller account",
  })
  async confirm(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: AdminSellerOrderActionDto,
  ) {
    this.requireKey(key);
    const userId = this.userId(req);
    const result = await this.fulfillment.confirmAdmin(
      userId,
      id,
      key,
      body.expectedVersion,
      body.reason,
    );
    return {
      data: await this.orders.getSellerPart(userId, result.shopId, id, true),
    };
  }

  @Post(":id/pack")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Pack a seller order for a locked Seller account" })
  async pack(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: AdminSellerOrderActionDto,
  ) {
    this.requireKey(key);
    const userId = this.userId(req);
    const result = await this.fulfillment.packAdmin(
      userId,
      id,
      key,
      body.expectedVersion,
      body.reason,
    );
    return {
      data: await this.orders.getSellerPart(userId, result.shopId, id, true),
    };
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
