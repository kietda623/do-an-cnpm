import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { CartController } from "./controllers/cart.controller.js";
import { CartService } from "./services/cart.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
