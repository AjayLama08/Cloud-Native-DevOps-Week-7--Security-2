import type { ListProductsDeps } from '../app/list-products';
import type { UpsertProductDeps } from '../app/upsert-product';
import type { ProductRepo } from '../domain/product-repo';
import { FakeProductRepo } from '../infra/fake-product-repo';

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

export const createUpsertProductDeps = (): UpsertProductDeps => ({
  productRepo: getProductRepo(),
  now: () => new Date(),
});
