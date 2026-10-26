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
import type { ApiRequest } from "../../../common/http/request.types.js";
import { RequireAdminPermission } from "../../../common/auth/permissions.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import { ShippingService } from "../../shipping/services/shipping.service.js";

class ReturnConfirmationDto {
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

@ApiTags("admin")
@ApiBearerAuth("BearerAuth")
@Controller("admin/shipments")
@UseGuards(AccessGuard, AdminGuard)
@RequireAdminPermission("confirmReturn")
export class ReturnConfirmationController {
  constructor(private readonly shipping: ShippingService) {}

  @Post(":id/return-confirmation")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({
    summary: "Confirm a failed shipment has returned and restore stock once",
  })
  async confirm(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("idempotency-key") key: string,
    @Body() body: ReturnConfirmationDto,
  ) {
    if (!isUUID(key))
      throw new BadRequestException({ code: "INVALID_IDEMPOTENCY_KEY" });
    const actor = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    );
    const shipment = await this.shipping.confirmReturn(
      actor.userId,
      id,
      key,
      body,
    );
    return {
      data: { affectedResourceIds: [shipment.sellerOrderId], shipment },
    };
  }
}
