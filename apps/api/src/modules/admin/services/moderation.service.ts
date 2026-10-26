import { Injectable } from "@nestjs/common";
import { CatalogService } from "../../catalog/services/catalog.service.js";

@Injectable()
export class AdminModerationService {
  constructor(private readonly catalog: CatalogService) {}

  listProducts(query: Parameters<CatalogService["adminListProducts"]>[0]) {
    return this.catalog.adminListProducts(query);
  }

  hideProduct(
    actorUserId: string,
    productId: string,
    key: string,
    input: { reason: string; expectedVersion: number },
    requestId?: string,
  ) {
    return this.catalog.hideProductByAdmin(
      actorUserId,
      productId,
      key,
      input,
      requestId,
    );
  }
}
