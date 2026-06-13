import { logger } from '../utils/logger';

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret';
let warned = false;

/**
 * JWT secret must be explicitly configured in production — the server
 * refuses to start rather than silently signing with a known fallback.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }

  if (!warned) {
    logger.warn('JWT_SECRET is not set — using an insecure development-only fallback secret');
    warned = true;
  }
  return DEV_FALLBACK_SECRET;
}
