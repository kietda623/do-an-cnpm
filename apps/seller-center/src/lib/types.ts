export type Asset = { id: string; url: string };

export type ShopStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  contactAddress: string;
  phone: string;
  logo: Asset;
  banner: Asset | null;
  status: ShopStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  version: number;
};

export type Membership = {
  shopId: string;
  shopName: string;
  shopStatus: ShopStatus;
  role: string;
};

export type SellerStats = {
  shopId: string;
  productCount: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  completedRevenue: string;
  currency: string;
  simulated: boolean;
  from: string;
  to: string;
  timezone: string;
};

export type RevenuePoint = {
  period: string;
  completedCount: number;
  revenue: string;
};

export type RevenueSeries = {
  shopId: string;
  groupBy: "DAY" | "MONTH";
  points: RevenuePoint[];
  totalRevenue: string;
  currency: string;
  simulated: boolean;
  timezone: string;
};

export type Shipment = {
  id: string;
  status: string;
  version: number;
  attemptNumber: number;
  trackingCode: string;
};

export type SellerPart = {
  id: string;
  orderId: string;
  status: string;
  version: number;
  originalTotal: string;
  outstandingAmount: string;
  shipment: Shipment | null;
  items: Array<{ id: string; productName: string; quantity: number }>;
};

export type SellerReview = {
  id: string;
  productId: string;
  shopId: string;
  orderItemId: string;
  buyerDisplayName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type CatalogProductImage = { assetId: string; objectKey?: string };

export type CatalogProductVariant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: string;
  selling: boolean;
  version: number;
  availableQuantity: number;
  inventoryVersion: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  selling: boolean;
  version: number;
  images: CatalogProductImage[];
  variants: CatalogProductVariant[];
};

export type Category = { id: string; name: string };
