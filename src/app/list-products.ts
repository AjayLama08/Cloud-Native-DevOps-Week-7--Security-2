import type { ProductRepo } from '../domain/product-repo';
import type { AuthContext } from './auth-context';

export type ListProductsDeps = {
  readonly productRepo: ProductRepo;
  readonly authContext: AuthContext;
};

// DTO for listing products with optional price redaction
export type ProductListItem = {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number | null; // null for anonymous callers
  readonly description: string;
  readonly updatedAt: Date;
};

export type ListProductsResult =
  | { readonly success: true; readonly data: readonly ProductListItem[] }
  | {
      readonly success: false;
      readonly failure: 'forbidden';
      readonly error: string;
    };

/**
 * Create a use-case for listing products.
 * Anonymous callers receive redacted prices. Authenticated callers require
 * 'read:products', which permits access to prices in this example.
 * Usage:
 *   const result = await listProducts({ productRepo, authContext });
 */
export async function listProducts(
  deps: ListProductsDeps,
): Promise<ListProductsResult> {
  const { productRepo, authContext } = deps;

  if (
    authContext.authenticated &&
    !authContext.scopes.includes('read:products')
  ) {
    return {
      success: false,
      failure: 'forbidden',
      error: 'The read:products scope is required',
    };
  }

  const products = await productRepo.list();

  // Authenticated callers have already passed the read:products check.
  const canReadPrices =
    authContext.authenticated && authContext.scopes.includes('read:products');

  // Redact prices if the scope is missing
  const processedProducts: readonly ProductListItem[] = products.map(
    (product) => {
      if (canReadPrices) {
        return product;
      }
      // Return product with price redacted (null)
      return {
        ...product,
        pricePence: null,
      };
    },
  );

  return { success: true, data: processedProducts };
}
