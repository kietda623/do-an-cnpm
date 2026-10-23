import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { ApiRequest } from "../../../common/http/request.types.js";
import type { AccessContext } from "../../../common/auth/access-context.js";
import { AccessGuard, currentAccessContext } from "../../identity/access.guard.js";
import { AdminGuard } from "../../shop/admin.guard.js";
import { CatalogService } from "../services/catalog.service.js";
class CategoryWriteDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsBoolean() visible!: boolean;
}
class CategoryPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsInt() @Min(0) expectedVersion!: number;
}
class VariantDto {
  @IsString() @MinLength(1) @MaxLength(100) sku!: string;
  @IsObject() attributes!: Record<string, unknown>;
  @IsString() @Matches(/^\d+$/) price!: string;
  @IsInt() @Min(0) stock!: number;
  @IsBoolean() selling!: boolean;
}
class ProductWriteDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(20000) description!: string;
  @IsUUID() categoryId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID("all", { each: true })
  imageAssetIds!: string[];
  @IsBoolean() selling!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];
}
class ProductPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID("all", { each: true })
  imageAssetIds?: string[];
  @IsOptional() @IsBoolean() selling?: boolean;
  @IsInt() @Min(0) expectedVersion!: number;
}
class VariantPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) sku?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsString() @Matches(/^\d+$/) price?: string;
  @IsOptional() @IsBoolean() selling?: boolean;
  @IsInt() @Min(0) expectedVersion!: number;
}
@ApiTags("categories")
@Controller("categories")
export class PublicCategoriesController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() @ApiOperation({ summary: "List public categories" }) async get(
    @Query("parentId") parentId?: string,
    @Query("tree") tree?: string,
  ) {
    return { data: await this.catalog.categories(parentId, tree === "true") };
  }
}
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/categories")
@UseGuards(AccessGuard, AdminGuard)
export class AdminCategoriesController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() @ApiOperation({ summary: "List all categories for administration" }) async list() {
    return { data: await this.catalog.adminCategories() };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a category" })
  async create(@Req() req: ApiRequest, @Body() body: CategoryWriteDto) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.catalog.createCategory(userId, body) };
  }
  @Patch(":id") @ApiOperation({ summary: "Update a category" }) async patch(
    @Req() req: ApiRequest,
    @Param("id") id: string,
    @Body() body: CategoryPatchDto,
  ) {
    const userId = currentAccessContext(
      req as ApiRequest & { accessContext?: AccessContext },
    ).userId;
    return { data: await this.catalog.patchCategory(userId, id, body) };
  }
}
@ApiTags("products")
@ApiBearerAuth()
@Controller("shops/:shopId")
@UseGuards(AccessGuard)
export class ManagementProductListController {
  constructor(private readonly catalog: CatalogService) {}
  @Get("management/products")
  @ApiOperation({ summary: "List shop products for management" })
  async list(@Req() req: ApiRequest, @Param("shopId") shopId: string) {
    return {
      data: await this.catalog.listManagement(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
      ),
    };
  }
}
@ApiTags("products")
@ApiBearerAuth()
@Controller("shops/:shopId/products")
@UseGuards(AccessGuard)
export class ProductManagementController {
  constructor(private readonly catalog: CatalogService) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a shop product" })
  async create(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Body() body: ProductWriteDto,
  ) {
    return {
      data: await this.catalog.createProduct(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        body,
      ),
    };
  }
  @Get() @ApiOperation({ summary: "List management products" }) async list(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
  ) {
    return {
      data: await this.catalog.listManagement(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
      ),
    };
  }
  @Get(":id/management") @ApiOperation({ summary: "Read management product" }) async get(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
  ) {
    return {
      data: await this.catalog.getManagement(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
      ),
    };
  }
  @Patch(":id") @ApiOperation({ summary: "Update a shop product" }) async patch(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
    @Body() body: ProductPatchDto,
  ) {
    return {
      data: await this.catalog.patchProduct(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
        body,
      ),
    };
  }
  @Post(":id/variants")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a product variant" })
  async variant(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
    @Body() body: VariantDto,
  ) {
    return {
      data: await this.catalog.createVariant(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
        body,
      ),
    };
  }
}
@ApiTags("products")
@ApiBearerAuth()
@Controller("shops/:shopId/variants")
@UseGuards(AccessGuard)
export class VariantManagementController {
  constructor(private readonly catalog: CatalogService) {}
  @Patch(":id") @ApiOperation({ summary: "Update a product variant" }) async patch(
    @Req() req: ApiRequest,
    @Param("shopId") shopId: string,
    @Param("id") id: string,
    @Body() body: VariantPatchDto,
  ) {
    return {
      data: await this.catalog.patchVariant(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        shopId,
        id,
        body,
      ),
    };
  }
}
