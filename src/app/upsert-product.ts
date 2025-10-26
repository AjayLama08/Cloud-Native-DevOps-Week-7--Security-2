import { createProduct } from '../domain/product';
import type { Product, ProductValidationIssue } from '../domain/product';
import type { ProductRepo } from '../domain/product-repo';

export type UpsertProductDeps = {
  readonly productRepo: ProductRepo;
  readonly now: () => Date;
};

export type UpsertProductCommand = {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number;
  readonly description: string;
};

export type UpsertProductResult =
  | { readonly success: true; readonly data: Product }
  | {
      readonly success: false;
      readonly failure: 'validation';
      readonly issues: readonly ProductValidationIssue[];
    };

/**
 * Create a use-case for upserting a product.
 * This will create a new product or update an existing one.
 * Usage:
 *   const result = await upsertProduct({ productRepo, now: () => new Date() }, productData);
 */
export async function upsertProduct(
  deps: UpsertProductDeps,
  command: UpsertProductCommand,
): Promise<UpsertProductResult> {
  const { productRepo, now } = deps;

  const creation = createProduct({ ...command, updatedAt: now() });
  if (!creation.success) {
    // The domain identifies invalid values; their origin determines the outcome.
    if (creation.issues.some((issue) => issue.field === 'updatedAt')) {
      throw new Error('Application clock returned an invalid timestamp');
    }
    return { success: false, failure: 'validation', issues: creation.issues };
  }
  const savedProduct = await productRepo.save(creation.data);
  return { success: true, data: savedProduct };
}
