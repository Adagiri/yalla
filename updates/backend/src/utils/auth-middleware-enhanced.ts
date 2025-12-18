import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { authTokenCache } from '../services/auth-token-cache.service';

/**
 * Enhanced auth middleware with optional Redis cache validation
 */

export const getUserInfo = (token: string) => {
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET_KEY as string);
    return payload || null;
  } catch {
    return null;
  }
};

export const extractUserFromToken = (token: string) => {
  try {
    const decoded = jwt.verify(
      token,
      ENV.JWT_SECRET_KEY as string
    ) as any;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Enhanced token validation with Redis cache check
 * Set USE_REDIS_AUTH_CACHE=true in .env to enable Redis validation
 */
export const validateToken = async (token: string): Promise<any> => {
  try {
    // 1. Verify JWT signature and expiry
    const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY as string) as any;

    // 2. Optional: Check if token exists in Redis cache
    // This allows instant invalidation on logout/password change
    if (ENV.USE_REDIS_AUTH_CACHE === 'true') {
      const isValid = await authTokenCache.isTokenValid(token);

      if (!isValid) {
        throw new Error('Token has been invalidated');
      }
    }

    return decoded;
  } catch (error: any) {
    throw new Error(error.message || 'Invalid token');
  }
};

/**
 * Middleware to validate token with optional Redis check
 * Usage: Can be used in GraphQL context or Express middleware
 */
export const validateAuthToken = async (authHeader: string): Promise<any> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  return await validateToken(token);
};
