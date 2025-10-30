import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { upsertProduct } from '../app/upsert-product';
import type { UpsertProductCommand } from '../app/upsert-product';
import { createUpsertProductDeps } from '../config/composition-root';

type ParseResult =
  | { readonly success: true; readonly data: UpsertProductCommand }
  | { readonly success: false; readonly error: string };

function parseCommand(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { success: false, error: 'Request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  const { id, name, pricePence, description } = record;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    typeof pricePence !== 'number'
  ) {
    return {
      success: false,
      error:
        'Fields id, name and description must be strings; pricePence must be a number',
    };
  }
  return { success: true, data: { id, name, pricePence, description } };
}

const upsertProductHandler = async (
  request: HttpRequest,
): Promise<HttpResponseInit> => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Request body must be valid JSON',
        },
      };
    }

    const parsed = parseCommand(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: { success: false, message: parsed.error },
      };
    }

    const deps = createUpsertProductDeps();
    const result = await upsertProduct(deps, parsed.data);

    if (!result.success) {
      if (result.failure === 'notification') {
        return {
          status: 502,
          jsonBody: {
            success: false,
            message: 'Product saved, but the update notification failed',
            productSaved: true,
          },
        };
      }
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Failed to upsert product',
          error: result.issues.map((issue) => issue.message).join(' '),
        },
      };
    }

    return {
      status: 200,
      jsonBody: {
        id: result.data.id,
        name: result.data.name,
        pricePence: result.data.pricePence,
        description: result.data.description,
        updatedAt: result.data.updatedAt.toISOString(),
      },
    };
  } catch {
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Internal server error',
      },
    };
  }
};

app.http('upsertProductHttp', {
  methods: ['PUT', 'POST'],
  authLevel: 'anonymous',
  route: 'products',
  handler: upsertProductHandler,
});
