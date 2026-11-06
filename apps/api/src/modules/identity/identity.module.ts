import { Module } from "@nestjs/common";
import { AuthController, UserController } from "./identity.controller.js";
import { AuthService } from "./identity.service.js";
import { AccessGuard } from "./access.guard.js";
import { CsrfRequestMiddleware } from "../../common/http/csrf-request.middleware.js";
import { AssetService } from "../catalog/media/asset.service.js";
import { AssetController } from "../catalog/media/asset.controller.js";

@Module({
  controllers: [AuthController, UserController, AssetController],
  providers: [AuthService, AccessGuard, CsrfRequestMiddleware, AssetService],
  exports: [AuthService, AccessGuard],
})
export class IdentityModule {}
