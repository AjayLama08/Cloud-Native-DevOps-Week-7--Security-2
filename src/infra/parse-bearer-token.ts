import { InvalidAccessTokenError } from './oauth2-validator';

/** An absent header is anonymous; a supplied but malformed header is invalid. */
export const parseBearerToken = (header: string | null): string | null => {
  if (header === null) return null;

  const match = /^Bearer[\t ]+(\S+)$/i.exec(header);
  if (!match) throw new InvalidAccessTokenError('Invalid bearer token');
  return match[1];
};
