import type { Product } from '../domain/product';
import type { ProductRepo } from '../domain/product-repo';

function cloneProduct(product: Product): Product {
  return {
    ...product,
    updatedAt: new Date(product.updatedAt.getTime()),
  };
}

/**
 * Fake in-memory implementation of ProductRepo for tests and local dev.
 * Not safe for concurrency across processes — intended as a fake.
 */
export class FakeProductRepo implements ProductRepo {
  private readonly store: Map<string, Product> = new Map();

  constructor(initial: readonly Product[] = []) {
    for (const p of initial) this.store.set(p.id, cloneProduct(p));
  }

  async getById(id: string): Promise<Product | null> {
    const found = this.store.get(id) ?? null;
    return found ? cloneProduct(found) : null;
  }

  async list(): Promise<readonly Product[]> {
    return Array.from(this.store.values()).map(cloneProduct);
  }

  async save(product: Product): Promise<Product> {
    // upsert semantics: store the product, return the saved copy
    const toStore = cloneProduct(product);
    this.store.set(toStore.id, toStore);
    return cloneProduct(toStore);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
