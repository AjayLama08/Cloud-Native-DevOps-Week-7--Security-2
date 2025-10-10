import type { Product } from './product';

/**
 * Repository interface for persisting and retrieving Product entities.
 * Implementations should map these methods to whatever backing store is used
 * (in-memory, database, external service, etc.).
 */
export interface ProductRepo {
  /**
   * Fetch a product by id. Returns null if not found.
   */
  getById(id: string): Promise<Product | null>;

  /**
   * List all products. Implementations may choose to add pagination later.
   */
  list(): Promise<readonly Product[]>;

  /**
   * Save a product (create or update / upsert).
   * Implementations should insert the product if it does not exist, or
   * update the existing record if it does. Return the saved Product (which
   * may include store-generated fields or normalized values).
   */
  save(product: Product): Promise<Product>;

  /**
   * Remove a product by id. No-op if the product does not exist.
   */
  delete(id: string): Promise<void>;
}
