import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import {
  AccessGuard,
  currentAccessContext,
} from "../../identity/access.guard.js";
import { ReviewService } from "../services/review.service.js";

class ReviewCreateDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() orderItemId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  comment!: string;
}
class ReviewListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
class ShopReviewListQuery extends ReviewListQuery {
  @IsOptional() @IsUUID() productId?: string;
}

@ApiTags("reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Post("reviews")
  @UseGuards(AccessGuard)
  @ApiBearerAuth("BearerAuth")
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409 })
  @ApiResponse({ status: 422 })
  async create(@Req() req: ApiRequest, @Body() body: ReviewCreateDto) {
    return {
      data: await this.reviews.create(
        currentAccessContext(
          req as ApiRequest & { accessContext?: AccessContext },
        ).userId,
        body,
      ),
    };
  }

  @Get("products/:id/reviews")
  @ApiQuery({ name: "rating", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  publicList(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: ReviewListQuery,
  ) {
    return this.reviews.publicList(id, query);
  }

  @Get("shops/:id/reviews")
  @UseGuards(AccessGuard)
  @ApiBearerAuth("BearerAuth")
  @ApiQuery({ name: "productId", required: false, format: "uuid" })
  @ApiQuery({ name: "rating", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  shopList(
    @Req() req: ApiRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() query: ShopReviewListQuery,
  ) {
    return this.reviews.shopList(
      currentAccessContext(
        req as ApiRequest & { accessContext?: AccessContext },
      ).userId,
      id,
      query,
    );
  }
}
