import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiResponse as ApiDocResponse, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { ApiRequest, ApiResponse } from "../../common/http/request.types.js";
import type { AccessContext } from "../../common/auth/access-context.js";
import { allowedBrowserOrigins } from "../../common/http/allowed-origins.js";
import { AccessGuard, currentAccessContext } from "./access.guard.js";
import { AuthService } from "./identity.service.js";
import { AssetService } from "../catalog/media/asset.service.js";

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @IsString() @MinLength(1) @MaxLength(120) fullName!: string;
  @IsIn(["WEB", "ANDROID", "IOS", "WINDOWS", "MACOS"]) clientPlatform!:
    "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
}
class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @IsIn(["WEB", "ANDROID", "IOS", "WINDOWS", "MACOS"]) clientPlatform!:
    "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
}
class RefreshDto {
  @IsOptional() @IsString() refreshToken?: string;
  @IsIn(["WEB", "ANDROID", "IOS", "WINDOWS", "MACOS"]) clientPlatform!:
    "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
}
class LogoutDto {
  @IsOptional() @IsString() refreshToken?: string;
  @IsOptional()
  @IsIn(["WEB", "ANDROID", "IOS", "WINDOWS", "MACOS"])
  clientPlatform?: "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
}
class ProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) fullName?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string | null;
  @IsOptional() @IsString() avatarAssetId?: string | null;
}
class PasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(1) @MaxLength(128) newPassword!: string;
}
class AddressDto {
  @IsString() @MinLength(1) @MaxLength(120) recipientName!: string;
  @IsString() @MinLength(8) @MaxLength(20) phone!: string;
  @IsString() @MinLength(1) @MaxLength(250) line1!: string;
  @IsString() @MinLength(1) @MaxLength(120) ward!: string;
  @IsString() @MinLength(1) @MaxLength(120) district!: string;
  @IsString() @MinLength(1) @MaxLength(120) province!: string;
  @IsIn(["VN"]) country!: "VN";
  @IsBoolean() isDefault!: boolean;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
}
class AddressPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) recipientName?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(250) line1?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) ward?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) district?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) province?: string;
  @IsOptional() @IsIn(["VN"]) country?: "VN";
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("csrf")
  @ApiOperation({ summary: "Issue a browser CSRF token" })
  csrf(@Req() req: ApiRequest, @Res({ passthrough: true }) res: ApiResponse) {
    const origin = req.headers.origin;
    const allow = allowedBrowserOrigins(this.config);
    if (origin && !allow.has(Array.isArray(origin) ? origin[0]! : origin))
      throw new ForbiddenException({ code: "ORIGIN_REJECTED", message: "Origin is not allowed." });
    return this.auth.csrf().then(({ csrfToken, cookie }) => {
      res.setHeader("Set-Cookie", `csrf=${cookie}; Path=/api/v1/auth; Secure; SameSite=Lax;`);
      return { data: { csrfToken } };
    });
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a buyer" })
  @ApiDocResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: "The request exceeded an authentication rate limit.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
    headers: {
      "Retry-After": {
        description: "Seconds until the request can be retried.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiDocResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Rate limiting is unavailable.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
  })
  async register(
    @Body() body: RegisterDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: ApiResponse,
  ) {
    const result = await this.auth.register(body, req.ip);
    return this.browserTokens(body.clientPlatform, result, res);
  }
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate a user" })
  @ApiDocResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: "The request exceeded an authentication rate limit.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
    headers: {
      "Retry-After": {
        description: "Seconds until the request can be retried.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiDocResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Rate limiting is unavailable.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
  })
  async login(
    @Body() body: LoginDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: ApiResponse,
  ) {
    const result = await this.auth.login(body, req.ip);
    return this.browserTokens(body.clientPlatform, result, res);
  }
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh credential" })
  @ApiDocResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: "The request exceeded an authentication rate limit.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
    headers: {
      "Retry-After": {
        description: "Seconds until the request can be retried.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiDocResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Rate limiting is unavailable.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
      },
    },
  })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: ApiRequest,
    @Res({ passthrough: true }) res: ApiResponse,
  ) {
    const refreshToken = body.refreshToken ?? cookieValue(req.headers.cookie, "refresh_token");
    const result = await this.auth.refresh(refreshToken, body.clientPlatform, req.ip);
    return this.browserTokens(body.clientPlatform, result, res);
  }
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessGuard)
  @ApiOperation({ summary: "Revoke the current session" })
  async logout(
    @Req() req: ApiRequest,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) res: ApiResponse,
  ) {
    await this.auth.logout(
      currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }),
      body?.refreshToken ?? cookieValue(req.headers.cookie, "refresh_token"),
    );
    res.setHeader(
      "Set-Cookie",
      "refresh_token=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    );
  }
  private browserTokens(platform: string, result: Record<string, unknown>, response: ApiResponse) {
    const { refreshToken, ...safe } = result;
    if (platform === "WEB")
      response.setHeader(
        "Set-Cookie",
        `refresh_token=${refreshToken}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=604800;`,
      );
    return { data: platform === "WEB" ? { ...safe, refreshToken: null } : result };
  }
}

@ApiTags("users")
@Controller("users/me")
@UseGuards(AccessGuard)
export class UserController {
  constructor(
    private readonly auth: AuthService,
    private readonly assets: AssetService,
  ) {}
  @Get() @ApiOperation({ summary: "Get the current user profile" }) async me(
    @Req() req: ApiRequest,
  ) {
    return {
      data: await this.auth.me(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
      ),
    };
  }
  @Patch() @ApiOperation({ summary: "Update the current user profile" }) async patch(
    @Req() req: ApiRequest,
    @Body() body: ProfileDto,
  ) {
    return {
      data: await this.auth.patchProfile(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        body,
      ),
    };
  }
  @Post("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Change the current user's password" })
  async password(@Req() req: ApiRequest, @Body() body: PasswordDto) {
    await this.auth.changePassword(
      currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }),
      body,
    );
  }
  @Get("addresses") @ApiOperation({ summary: "List the current user's addresses" }) async addresses(
    @Req() req: ApiRequest,
  ) {
    return {
      data: await this.auth.addresses(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
      ),
    };
  }
  @Post("addresses")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create an address" })
  async createAddress(@Req() req: ApiRequest, @Body() body: AddressDto) {
    return {
      data: await this.auth.createAddress(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        body as unknown as Record<string, unknown>,
      ),
    };
  }
  @Patch("addresses/:id") @ApiOperation({ summary: "Update an address" }) async updateAddress(
    @Req() req: ApiRequest,
    @Param("id") id: string,
    @Body() body: AddressPatchDto,
  ) {
    return {
      data: await this.auth.updateAddress(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        id,
        body as Record<string, unknown>,
      ),
    };
  }
  @Delete("addresses/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an address" })
  async deleteAddress(@Req() req: ApiRequest, @Param("id") id: string) {
    await this.auth.deleteAddress(
      currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
      id,
    );
  }
  @Post("assets")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Upload an account media asset" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  async upload(
    @Req() req: ApiRequest,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    @Body("purpose") purpose: string,
    @Body("shopId") shopId?: string,
  ) {
    return {
      data: await this.assets.upload(
        currentAccessContext(req as ApiRequest & { accessContext?: AccessContext }).userId,
        file,
        purpose,
        shopId,
      ),
    };
  }
}

function cookieValue(header: string | string[] | undefined, name: string): string | undefined {
  const text = Array.isArray(header) ? header[0] : header;
  return text
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
