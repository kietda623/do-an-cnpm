import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DiscoveryService } from "../services/discovery.service.js";

const sorts = ["PRICE_ASC", "PRICE_DESC", "NEWEST"] as const;
class DiscoveryQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() shopId?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,18}$/) minPrice?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,18}$/) maxPrice?: string;
  @IsOptional() @IsIn(sorts) sort?: (typeof sorts)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

@ApiTags("discovery")
@Controller()
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get("products")
  @ApiOperation({ summary: "Search, filter, sort and page public products" })
  @ApiQuery({ name: "q", required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: "categoryId", required: false, format: "uuid" })
  @ApiQuery({ name: "shopId", required: false, format: "uuid" })
  @ApiQuery({ name: "minPrice", required: false, type: String, pattern: "^[0-9]{1,18}$" })
  @ApiQuery({ name: "maxPrice", required: false, type: String, pattern: "^[0-9]{1,18}$" })
  @ApiQuery({ name: "sort", required: false, enum: sorts })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100 })
  async products(@Query() query: DiscoveryQueryDto) {
    if (query.minPrice && query.maxPrice && BigInt(query.minPrice) > BigInt(query.maxPrice))
      throw new BadRequestException({
        code: "INVALID_PRICE_RANGE",
        message: "minPrice must not exceed maxPrice.",
      });
    return this.discovery.list(query);
  }

  @Get("products/:id")
  @ApiOperation({ summary: "Get a public product and active variants" })
  async product(@Param("id", new ParseUUIDPipe()) id: string) {
    return { data: await this.discovery.product(id) };
  }

  @Get("shops/:id/products")
  @ApiOperation({ summary: "List publicly sellable products for an active shop" })
  @ApiQuery({ name: "q", required: false, type: String, maxLength: 200 })
  @ApiQuery({ name: "categoryId", required: false, format: "uuid" })
  @ApiQuery({ name: "minPrice", required: false, type: String, pattern: "^[0-9]{1,18}$" })
  @ApiQuery({ name: "maxPrice", required: false, type: String, pattern: "^[0-9]{1,18}$" })
  @ApiQuery({ name: "sort", required: false, enum: sorts })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100 })
  async shopProducts(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: DiscoveryQueryDto,
  ) {
    if (query.shopId)
      throw new BadRequestException({
        code: "INVALID_QUERY_PARAMETER",
        message: "Use the shop id from the path instead of shopId query parameter.",
      });
    if (query.minPrice && query.maxPrice && BigInt(query.minPrice) > BigInt(query.maxPrice))
      throw new BadRequestException({
        code: "INVALID_PRICE_RANGE",
        message: "minPrice must not exceed maxPrice.",
      });
    return this.discovery.shopProducts(id, query);
  }
}
