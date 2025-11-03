import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import type { AuthContext } from '../app/auth-context';

export type OAuth2ValidatorOptions = {
  readonly jwksUri: string;
  readonly issuer: string;
  readonly audience: string;
};

export class InvalidAccessTokenError extends Error {}

export class TokenVerificationUnavailableError extends Error {}

export class OAuth2Validator {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(options: OAuth2ValidatorOptions) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUri));
    this.issuer = options.issuer;
    this.audience = options.audience;
  }

  /**
   * Validate the access token and extract authentication context
   */
  async validate(token: string): Promise<AuthContext> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        requiredClaims: ['exp'],
      });

      // Extract scopes from token
      // OAuth2 tokens typically include scopes in the 'scope' claim as a space-separated string
      // or as a 'scp' claim (Azure AD style) as an array or string
      let scopes: string[] = [];

      if (typeof payload.scope === 'string') {
        scopes = payload.scope.split(' ').filter((s) => s.trim() !== '');
      } else if (typeof payload.scp === 'string') {
        scopes = payload.scp.split(' ').filter((s) => s.trim() !== '');
      } else if (Array.isArray(payload.scp)) {
        scopes = payload.scp.filter(
          (scope): scope is string => typeof scope === 'string',
        );
      }

      return {
        authenticated: true,
        scopes,
        subject: typeof payload.sub === 'string' ? payload.sub : undefined,
      };
    } catch (error) {
      // Only credential failures are 401s. JWKS/network failures are service errors.
      if (
        error instanceof errors.JWTExpired ||
        error instanceof errors.JWTClaimValidationFailed ||
        error instanceof errors.JWTInvalid ||
        error instanceof errors.JWSInvalid ||
        error instanceof errors.JOSEAlgNotAllowed ||
        error instanceof errors.JOSENotSupported ||
        error instanceof errors.JWSSignatureVerificationFailed ||
        error instanceof errors.JWKSNoMatchingKey
      ) {
        throw new InvalidAccessTokenError('Invalid or expired bearer token');
      }
      throw new TokenVerificationUnavailableError(
        'Token verification unavailable',
        { cause: error },
      );
    }
  }
}
