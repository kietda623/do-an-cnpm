import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { InventoryService } from "../services/inventory.service.js";
class AdjustDto {
  @IsInt() delta!: number;
  @IsString() @MinLength(1) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}
@ApiTags("inventory")
@ApiBearerAuth()
@Controller("shops/:shopId/variants/:id")
@UseGuards(AccessGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get("inventory") @ApiOperation({ summary: "Read shop variant inventory" }) async get(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
  ) {
    return {
      data: await this.inventory.get(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
      ),
    };
  }
  @Post("inventory-adjustments")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Adjust shop variant inventory" })
  async adjust(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
    @Body() body: AdjustDto,
  ) {
    return {
      data: await this.inventory.adjust(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
        body,
      ),
    };
  }
}
