import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { parseBearerToken } from '../infra/parse-bearer-token';
import { listProducts } from '../app/list-products';
import { createListProductsDeps } from '../config/composition-root';
import {
  InvalidAccessTokenError,
  TokenVerificationUnavailableError,
} from '../infra/oauth2-validator';

const listProductsHandler = async (
  request: HttpRequest,
): Promise<HttpResponseInit> => {
  try {
    const token = parseBearerToken(request.headers.get('authorization'));
    const deps = await createListProductsDeps(token);
    const result = await listProducts(deps);

    if (!result.success) {
      return {
        status: 403,
        jsonBody: {
          success: false,
          message: result.error,
        },
      };
    }

    return {
      status: 200,
      jsonBody: result.data.map((product) => ({
        id: product.id,
        name: product.name,
        pricePence: product.pricePence,
        description: product.description,
        updatedAt: product.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof InvalidAccessTokenError) {
      return {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
        jsonBody: {
          success: false,
          message: 'Invalid or expired bearer token',
        },
      };
    }
    const unavailable = error instanceof TokenVerificationUnavailableError;
    return {
      status: unavailable ? 503 : 500,
      jsonBody: {
        success: false,
        message: unavailable
          ? 'Token verification unavailable'
          : 'Failed to list products',
      },
    };
  }
};

app.http('listProductsHttp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'products',
  handler: listProductsHandler,
});
