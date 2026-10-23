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
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsUUID, Min, isUUID } from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { PaymentService } from "../services/payment.service.js";
import { PaymentQueryService } from "../services/payment-query.service.js";

class StartMockAttemptDto {
  @IsUUID() orderId!: string;
}

class MockResultDto {
  @IsUUID() eventId!: string;
  @IsIn(["SUCCEEDED", "FAILED", "CANCELLED"]) outcome!: "SUCCEEDED" | "FAILED" | "CANCELLED";
  @IsInt() @Min(0) expectedVersion!: number;
}

class CodCollectionDto {
  @IsUUID() eventId!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

class PaymentQueryDto {
  @IsUUID() orderId!: string;
}

@ApiTags("payments")
@ApiBearerAuth()
@Controller("payments")
@UseGuards(AccessGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentService,
    private readonly paymentQueries: PaymentQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the payment attempts for a buyer-owned order" })
  async list(@Req() req: ApiRequest, @Query() query: PaymentQueryDto) {
    const context = this.context(req);
    return {
      data: await this.paymentQueries.list(context.userId, context.systemRole, query.orderId),
    };
  }

  @Post("mock-attempts")
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Create or replay a mock-payment attempt" })
  async start(
    @Req() req: ApiRequest,
    @Headers("idempotency-key") key: string,
    @Body() body: StartMockAttemptDto,
  ) {
    this.requireKey(key);
    return {
      data: await this.payments.startMockAttempt(this.context(req).userId, body.orderId, key),
    };
  }

  @Post(":id/mock-result")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Apply one deduplicated mock-payment result" })
  async result(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: MockResultDto,
  ) {
    this.requireKey(key);
    return { data: await this.payments.mockResult(this.context(req).userId, id, key, body) };
  }

  @Post("seller-orders/:id/cod-collection")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Record one server-priced COD collection after delivery" })
  async collectCod(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: CodCollectionDto,
  ) {
    this.requireKey(key);
    return {
      data: await this.payments.collectCod(
        this.context(req).userId,
        id,
        key,
        body.eventId,
        body.expectedVersion,
      ),
    };
  }

  private requireKey(key: string | undefined): asserts key is string {
    if (!isUUID(key))
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a UUID.",
      });
  }

  private context(req: ApiRequest): AccessContext {
    return currentAccessContext(req as ApiRequest & { accessContext?: AccessContext });
  }
}
