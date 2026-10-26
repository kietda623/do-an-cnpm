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
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  isUUID,
} from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { ShippingService } from "../services/shipping.service.js";

class ShipmentEventDto {
  @IsUUID() eventId!: string;
  @IsIn(["PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"])
  event!: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "FAILED";
  @ValidateIf(
    (body: ShipmentEventDto) =>
      body.event === "FAILED" || body.reason !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

class RetryDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

@ApiTags("shipments")
@ApiBearerAuth()
@Controller("shipments")
@UseGuards(AccessGuard)
export class ShipmentsController {
  constructor(private readonly shipping: ShippingService) {}

  @Get(":id")
  @ApiOperation({ summary: "Read shipment and immutable event history" })
  async get(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    const actor = this.actor(req);
    return {
      data: await this.shipping.get(actor.userId, actor.systemRole, id),
    };
  }

  @Post(":id/events")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Apply one adjacent shipment event" })
  async event(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ShipmentEventDto,
  ) {
    this.requireKey(key);
    const actor = this.actor(req);
    return {
      data: await this.shipping.event(
        actor.userId,
        actor.systemRole,
        id,
        key,
        body,
      ),
    };
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Retry a failed shipment without a new stock deduction",
  })
  async retry(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: RetryDto,
  ) {
    this.requireKey(key);
    const actor = this.actor(req);
    return {
      data: await this.shipping.retry(
        actor.userId,
        actor.systemRole,
        id,
        key,
        body,
      ),
    };
  }

  private actor(req: ApiRequest) {
    return currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
  }

  private requireKey(key: string | undefined): asserts key is string {
    if (!isUUID(key))
      throw new BadRequestException({ code: "INVALID_IDEMPOTENCY_KEY" });
  }
}
