import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsUUID, isUUID } from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { CheckoutService } from "../services/checkout.service.js";

class CheckoutDto {
  @IsUUID() quoteId!: string;
}

@ApiTags("checkout")
@ApiBearerAuth()
@Controller("checkout")
@UseGuards(AccessGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Commit a server-priced multi-shop quote atomically" })
  async create(
    @Req() req: ApiRequest,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() body: CheckoutDto,
  ) {
    if (!isUUID(idempotencyKey))
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a UUID.",
      });
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.checkout.create(userId, body.quoteId, idempotencyKey) };
  }
}
