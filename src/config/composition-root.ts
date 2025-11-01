import type { ListProductsDeps } from '../app/list-products';
import type { UpsertProductDeps } from '../app/upsert-product';
import type { ProductRepo } from '../domain/product-repo';
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
    cachedProductRepo = new FakeProductRepo();
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
