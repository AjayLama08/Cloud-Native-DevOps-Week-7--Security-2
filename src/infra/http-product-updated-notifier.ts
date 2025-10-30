import type {
  ProductUpdatedNotifier,
  ProductUpdatedDto,
} from '../app/product-updated-notifier';

export type HttpProductUpdatedNotifierOptions = {
  readonly endpoint: string;
  readonly fetch: typeof fetch;
};

export class HttpProductUpdatedNotifier implements ProductUpdatedNotifier {
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpProductUpdatedNotifierOptions) {
    let url: URL;
    try {
      url = new URL(options.endpoint);
    } catch {
      throw new Error(
        'PRODUCT_UPDATED_ENDPOINT must be a valid absolute HTTPS URL',
      );
    }
    if (url.protocol !== 'https:') {
      throw new Error(
        'PRODUCT_UPDATED_ENDPOINT must be a valid absolute HTTPS URL',
      );
    }
    this.endpoint = options.endpoint;
    this.fetchFn = options.fetch;
  }

  async notifyProductUpdated(product: ProductUpdatedDto): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(product),
    });
  }
}
