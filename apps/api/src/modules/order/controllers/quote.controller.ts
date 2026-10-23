import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsUUID } from "class-validator";
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { QuoteService } from "../services/quote.service.js";

class CheckoutQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  cartItemIds!: string[];
  @IsUUID() addressId!: string;
  @IsIn(["COD", "MOCK"]) paymentMethod!: "COD" | "MOCK";
}

@ApiTags("checkout")
@ApiBearerAuth()
@Controller("checkout/quotes")
@UseGuards(AccessGuard)
export class QuoteController {
  constructor(private readonly quotes: QuoteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a five-minute server-priced checkout quote" })
  async create(@Req() req: ApiRequest, @Body() body: CheckoutQuoteDto) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.quotes.create(userId, body) };
  }
}
