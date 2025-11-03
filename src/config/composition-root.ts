import type { ListProductsDeps } from '../app/list-products';
import type { UpsertProductDeps } from '../app/upsert-product';
import type { ProductRepo } from '../domain/product-repo';
import type { Product } from '../domain/product';
import { FakeProductRepo } from '../infra/fake-product-repo';
import { DummyProductUpdatedNotifier } from '../infra/dummy-product-updated-notifier';
import { HttpProductUpdatedNotifier } from '../infra/http-product-updated-notifier';
import type { ProductUpdatedNotifier } from '../app/product-updated-notifier';

// Editable, non-secret lab endpoint; empty deliberately selects dummy mode.
const PRODUCT_UPDATED_ENDPOINT: string = '';

let cachedProductUpdatedNotifier: ProductUpdatedNotifier | null = null;

export const getProductUpdatedNotifier = (): ProductUpdatedNotifier => {
  if (!cachedProductUpdatedNotifier) {
    const endpoint = PRODUCT_UPDATED_ENDPOINT;
    if (endpoint.trim() !== '') {
      const hostKey = process.env.PRODUCT_UPDATED_KEY ?? '';
      cachedProductUpdatedNotifier = new HttpProductUpdatedNotifier({
        endpoint,
        fetch: globalThis.fetch,
        hostKey,
      });
    } else {
      cachedProductUpdatedNotifier = new DummyProductUpdatedNotifier();
    }
  }
  return cachedProductUpdatedNotifier;
};

let cachedProductRepo: ProductRepo | null = null;

export const getProductRepo = (): ProductRepo => {
  if (!cachedProductRepo) {
    const now = new Date();
    const initialProducts: readonly Product[] = [
      {
        id: 'p-001',
        name: 'Seeded Widget',
        pricePence: 1299,
        description: 'A seeded example product for local testing.',
        updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        id: 'p-002',
        name: 'Seeded Gadget',
        pricePence: 2599,
        description: 'Another seeded product to get you started.',
        updatedAt: now,
      },
    ];
    cachedProductRepo = new FakeProductRepo(initialProducts);
  }
  return cachedProductRepo;
};

export const createListProductsDeps = (): ListProductsDeps => ({
  productRepo: getProductRepo(),
});

export const createUpsertProductDeps = (): UpsertProductDeps => {
  // Resolve and validate delivery configuration before constructing repository dependencies.
  const productUpdatedNotifier = getProductUpdatedNotifier();
  return {
    productRepo: getProductRepo(),
    now: () => new Date(),
    productUpdatedNotifier,
  };
};
