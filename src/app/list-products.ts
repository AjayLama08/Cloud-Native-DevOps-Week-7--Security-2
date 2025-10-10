import { Product } from '../domain/product';
import type { ProductRepo } from '../domain/product-repo';

export type ListProductsDeps = {
  readonly productRepo: ProductRepo;
};

export type ListProductsResult = {
  readonly success: true;
  readonly data: readonly Product[];
};

/**
 * Create a use-case for listing products.
 * Usage:
 *   const result = await listProducts({ productRepo });
 */
export async function listProducts(
  deps: ListProductsDeps,
): Promise<ListProductsResult> {
  const { productRepo } = deps;

  const products = await productRepo.list();
  return { success: true, data: products };
}
