// DTO for product update notification event
export type ProductUpdatedDto = {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number;
  readonly description: string;
  readonly updatedAt: string; // ISO string format
};

export interface ProductUpdatedNotifier {
  notifyProductUpdated(product: ProductUpdatedDto): Promise<void>;
}
