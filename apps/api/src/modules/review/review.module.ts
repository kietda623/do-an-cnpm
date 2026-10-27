import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { ReviewsController } from "./controllers/reviews.controller.js";
import { ReviewService } from "./services/review.service.js";

@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [ReviewsController],
  providers: [ReviewService],
})
export class ReviewModule {}
