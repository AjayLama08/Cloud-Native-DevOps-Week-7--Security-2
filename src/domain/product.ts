export type Product = {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number;
  readonly description: string;
  readonly updatedAt: Date;
};

export type CreateProductParams = {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number;
  readonly description: string;
  readonly updatedAt: Date;
};

export type ProductValidationIssue = {
  readonly field: keyof CreateProductParams;
  readonly message: string;
};

export type CreateProductResult =
  | { readonly success: true; readonly data: Product }
  | {
      readonly success: false;
      readonly issues: readonly ProductValidationIssue[];
    };

export function createProduct(
  params: CreateProductParams,
): CreateProductResult {
  const issues: ProductValidationIssue[] = [];
  if (typeof params.id !== 'string' || params.id.trim() === '') {
    issues.push({
      field: 'id',
      message: 'Product id must be a non-empty string.',
    });
  }
  if (typeof params.name !== 'string' || params.name.trim() === '') {
    issues.push({
      field: 'name',
      message: 'Product name must be a non-empty string.',
    });
  }
  if (!Number.isSafeInteger(params.pricePence) || params.pricePence < 0) {
    issues.push({
      field: 'pricePence',
      message: 'Product pricePence must be a non-negative safe integer.',
    });
  }
  if (
    typeof params.description !== 'string' ||
    params.description.trim() === ''
  ) {
    issues.push({
      field: 'description',
      message: 'Product description must be a non-empty string.',
    });
  }
  if (
    !(params.updatedAt instanceof Date) ||
    !Number.isFinite(params.updatedAt.getTime())
  ) {
    issues.push({
      field: 'updatedAt',
      message: 'updatedAt must be a valid Date object.',
    });
  }
  if (issues.length > 0) return { success: false, issues };
  return {
    success: true,
    data: {
      id: params.id,
      name: params.name,
      pricePence: params.pricePence,
      description: params.description,
      updatedAt: params.updatedAt,
    },
  };
}
