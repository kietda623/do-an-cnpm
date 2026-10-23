import { IsBoolean, IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";
import { Type } from "class-transformer";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { currentAccessContext, AccessGuard } from "../../identity/access.guard.js";
import { CartService } from "../services/cart.service.js";

class CartAddDto {
  @IsUUID() variantId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(999) quantity!: number;
}
class CartPatchDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() selected?: boolean;
}

@ApiTags("cart")
@ApiBearerAuth()
@Controller("cart")
@UseGuards(AccessGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated buyer's cart grouped by shop" })
  async get(@Req() req: ApiRequest) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.cart.get(userId) };
  }

  @Post("items")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add or merge a variant in the buyer cart" })
  async add(@Req() req: ApiRequest, @Body() body: CartAddDto) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.cart.add(userId, body) };
  }

  @Patch("items/:id")
  @ApiOperation({ summary: "Update cart quantity or selected state" })
  async patch(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) itemId: string,
    @Body() body: CartPatchDto,
  ) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.cart.patch(userId, itemId, body) };
  }

  @Delete("items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a cart item" })
  async remove(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) itemId: string) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    await this.cart.remove(userId, itemId);
  }
}
