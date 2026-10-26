import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  BadRequestException,
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
import type { ApiRequest } from "../../../common/http/request.types.js";
import { isAdmin } from "../../../common/auth/permissions.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { CancellationService } from "../services/cancellation.service.js";
import { OrderQueryService } from "../services/order-query.service.js";

class CancelOrderDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

@ApiTags("orders")
@ApiBearerAuth()
@Controller()
@UseGuards(AccessGuard)
export class CancellationController {
  constructor(
    private readonly cancellations: CancellationService,
    private readonly orders: OrderQueryService,
  ) {}

  @Post("orders/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Cancel all pending seller orders atomically" })
  async cancelAll(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: CancelOrderDto,
  ) {
    this.requireKey(key);
    const context = this.context(req);
    const result = await this.cancellations.cancelAll(
      context.userId,
      id,
      key,
      body,
    );
    return {
      data: {
        affectedResourceIds: result.summary.cancelledSellerOrderIds,
        resultingOrder: await this.orders.get(context.userId, id),
        replay: result.replay,
      },
    };
  }

  @Post("orders/:id/seller-orders/:sellerOrderId/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Cancel one pending seller order" })
  async cancelPart(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("sellerOrderId", new ParseUUIDPipe()) sellerOrderId: string,
    @Headers("idempotency-key") key: string,
    @Body() body: CancelOrderDto,
  ) {
    this.requireKey(key);
    const context = this.context(req);
    const result = await this.cancellations.cancelPart(
      context.userId,
      id,
      sellerOrderId,
      key,
      body,
    );
    return {
      data: {
        affectedResourceIds: [sellerOrderId],
        resultingOrder: await this.orders.get(context.userId, id),
        replay: result.replay,
      },
    };
  }

  @Post("shops/:shopId/orders/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Reject a pending or confirmed seller order" })
  async reject(
    @Req() req: ApiRequest,
    @Param("shopId", new ParseUUIDPipe()) shopId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: CancelOrderDto,
  ) {
    this.requireKey(key);
    const context = this.context(req);
    await this.cancellations.rejectSeller(
      context.userId,
      shopId,
      id,
      key,
      body,
    );
    return {
      data: await this.orders.getSellerPart(context.userId, shopId, id),
    };
  }

  @Post("admin/seller-orders/:id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Reject a seller order as an administrator" })
  async adminReject(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: CancelOrderDto,
  ) {
    const context = this.context(req);
    if (!isAdmin(context.systemRole)) throw new ForbiddenException();
    this.requireKey(key);
    const result = await this.cancellations.rejectAdmin(
      context.userId,
      id,
      key,
      body,
    );
    const order = await this.orders.get(
      context.userId,
      result.summary.orderId,
      true,
    );
    const sellerOrder = order.sellerOrders.find((part) => part.id === id);
    if (!sellerOrder) throw new NotFoundException();
    return { data: sellerOrder };
  }

  private requireKey(key: string | undefined): asserts key is string {
    if (!isUUID(key))
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a UUID.",
      });
  }

  private context(req: ApiRequest): AccessContext {
    return currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
  }
}
