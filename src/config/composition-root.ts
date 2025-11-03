import type { ListProductsDeps } from '../app/list-products';
import type { UpsertProductDeps } from '../app/upsert-product';
import type { ProductRepo } from '../domain/product-repo';
import type { Product } from '../domain/product';
import { FakeProductRepo } from '../infra/fake-product-repo';
import { DummyProductUpdatedNotifier } from '../infra/dummy-product-updated-notifier';
import { HttpProductUpdatedNotifier } from '../infra/http-product-updated-notifier';
import type { ProductUpdatedNotifier } from '../app/product-updated-notifier';
import {
  OAuth2Validator,
  TokenVerificationUnavailableError,
} from '../infra/oauth2-validator';
import type { AuthContext } from '../app/auth-context';

// Week 7 lab configuration: edit these non-secret values for your resources.
// Use the exact Auth0 issuer, including its trailing slash, and API identifier.
const AUTH0_ISSUER: string = '';
const AUTH0_AUDIENCE: string = '';
// Leave empty for the first local dummy-notifier check. To enable HTTP delivery,
// set the complete URL, e.g. https://YOUR_RECEIVER_HOSTNAME/api/product-updated.
const PRODUCT_UPDATED_ENDPOINT: string = '';
// Keep PRODUCT_UPDATED_KEY in the shell locally or Azure application settings.
// In assessment work, follow Week 5 to externalise the non-secret settings too.

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

let cachedOAuth2Validator: OAuth2Validator | null = null;

export const getOAuth2Validator = (): OAuth2Validator => {
  if (!cachedOAuth2Validator) {
    const issuer = AUTH0_ISSUER;
    const audience = AUTH0_AUDIENCE;

    if (!issuer || !audience) {
      throw new TokenVerificationUnavailableError(
        'Token verification is not configured',
      );
    }
    try {
      cachedOAuth2Validator = new OAuth2Validator({
        jwksUri: `${issuer}.well-known/jwks.json`,
        issuer,
        audience,
      });
    } catch (error) {
      throw new TokenVerificationUnavailableError(
        'Invalid token verification configuration',
        { cause: error },
      );
    }
  }
  return cachedOAuth2Validator;
};

export const createListProductsDeps = async (
  token: string | null,
): Promise<ListProductsDeps> => {
  const authContext: AuthContext =
    token === null
      ? { authenticated: false, scopes: [] }
      : await getOAuth2Validator().validate(token);

  return {
    productRepo: getProductRepo(),
    authContext,
  };
};

export const createUpsertProductDeps = (): UpsertProductDeps => {
  // Resolve and validate delivery configuration before constructing repository dependencies.
  const productUpdatedNotifier = getProductUpdatedNotifier();
  return {
    productRepo: getProductRepo(),
    now: () => new Date(),
    productUpdatedNotifier,
  };
};
