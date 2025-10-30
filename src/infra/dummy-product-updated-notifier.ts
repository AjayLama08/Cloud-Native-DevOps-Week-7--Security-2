import type {
  ProductUpdatedNotifier,
  ProductUpdatedDto,
} from '../app/product-updated-notifier';

export class DummyProductUpdatedNotifier implements ProductUpdatedNotifier {
  async notifyProductUpdated(product: ProductUpdatedDto): Promise<void> {
    // Dummy implementation: just log the event
    console.log('Product updated event:', product);
  }
}
