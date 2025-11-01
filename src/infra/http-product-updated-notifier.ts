import type {
  ProductUpdatedNotifier,
  ProductUpdatedDto,
} from '../app/product-updated-notifier';

export type HttpProductUpdatedNotifierOptions = {
  readonly endpoint: string;
  readonly fetch: typeof fetch;
  readonly hostKey: string;
};

export class HttpProductUpdatedNotifier implements ProductUpdatedNotifier {
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly hostKey: string;

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
    if (typeof options.hostKey !== 'string' || options.hostKey.trim() === '') {
      throw new Error('PRODUCT_UPDATED_KEY must be non-blank in HTTP mode');
    }
    this.endpoint = options.endpoint;
    this.fetchFn = options.fetch;
    this.hostKey = options.hostKey.trim();
  }

  async notifyProductUpdated(product: ProductUpdatedDto): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-functions-key': this.hostKey,
    };

    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(product),
    });

    // fetch resolves for HTTP errors too; only a 2xx response confirms delivery.
    if (!response.ok) {
      throw new Error(
        `Product update receiver returned HTTP ${response.status}`,
      );
    }
  }
}
