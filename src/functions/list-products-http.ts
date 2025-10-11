import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { listProducts } from '../app/list-products';
import { createListProductsDeps } from '../config/composition-root';

const listProductsHandler = async (
  _request: HttpRequest,
): Promise<HttpResponseInit> => {
  try {
    const deps = createListProductsDeps();
    const result = await listProducts(deps);
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
  } catch {
    return {
      status: 500,
      jsonBody: { success: false, message: 'Failed to list products' },
    };
  }
};

app.http('listProductsHttp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'products',
  handler: listProductsHandler,
});
