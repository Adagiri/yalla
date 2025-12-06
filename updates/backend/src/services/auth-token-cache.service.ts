import Redis from 'ioredis';
import { ENV } from '../config/env';

/**
 * Auth Token Cache Service
 * Stores active JWT tokens in Redis for easy invalidation
 */
export class AuthTokenCacheService {
  private redis: Redis;
  private readonly TOKEN_PREFIX = 'auth:token:';
  private readonly USER_TOKENS_PREFIX = 'auth:user:';

  // Default TTL matches JWT expiry (120 days for customers, 500 days for drivers)
  private readonly DEFAULT_TTL = 120 * 24 * 60 * 60; // 120 days in seconds

  constructor() {
    this.redis = new Redis({
      host: ENV.REDIS_HOST,
      port: parseInt(ENV.REDIS_PORT),
      password: ENV.REDIS_PASSWORD,
      db: 1, // Use different DB from cache (db 0)
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis Auth Token Cache connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis Auth Token Cache error:', error);
    });
  }

  /**
   * Store a token in Redis
   * @param token - JWT token
   * @param userId - User ID
   * @param accountType - CUSTOMER, DRIVER, or ADMIN
   * @param ttl - Time to live in seconds (optional, defaults to 120 days)
   */
  async storeToken(
    token: string,
    userId: string,
    accountType: string,
    ttl?: number
  ): Promise<void> {
    const tokenKey = `${this.TOKEN_PREFIX}${token}`;
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;

    const tokenData = {
      userId,
      accountType,
      issuedAt: new Date().toISOString(),
    };

    // Store token with metadata
    await this.redis.setex(
      tokenKey,
      ttl || this.DEFAULT_TTL,
      JSON.stringify(tokenData)
    );

    // Add token to user's token set
    await this.redis.sadd(userTokensKey, token);
    await this.redis.expire(userTokensKey, ttl || this.DEFAULT_TTL);
  }

  /**
   * Check if a token is valid (exists in Redis)
   * @param token - JWT token
   * @returns boolean
   */
  async isTokenValid(token: string): Promise<boolean> {
    const tokenKey = `${this.TOKEN_PREFIX}${token}`;
    const exists = await this.redis.exists(tokenKey);
    return exists === 1;
  }

  /**
   * Get token metadata
   * @param token - JWT token
   * @returns Token data or null
   */
  async getTokenData(token: string): Promise<any> {
    const tokenKey = `${this.TOKEN_PREFIX}${token}`;
    const data = await this.redis.get(tokenKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Invalidate a single token
   * @param token - JWT token
   */
  async invalidateToken(token: string): Promise<void> {
    const tokenData = await this.getTokenData(token);

    if (tokenData) {
      const tokenKey = `${this.TOKEN_PREFIX}${token}`;
      const userTokensKey = `${this.USER_TOKENS_PREFIX}${tokenData.userId}`;

      // Remove token
      await this.redis.del(tokenKey);

      // Remove from user's token set
      await this.redis.srem(userTokensKey, token);
    }
  }

  /**
   * Invalidate all tokens for a user
   * Useful when password is changed, account is suspended, etc.
   * @param userId - User ID
   */
  async invalidateAllUserTokens(userId: string): Promise<number> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;

    // Get all tokens for this user
    const tokens = await this.redis.smembers(userTokensKey);

    if (tokens.length === 0) {
      return 0;
    }

    // Delete all token keys
    const pipeline = this.redis.pipeline();
    for (const token of tokens) {
      const tokenKey = `${this.TOKEN_PREFIX}${token}`;
      pipeline.del(tokenKey);
    }

    // Delete user's token set
    pipeline.del(userTokensKey);

    await pipeline.exec();

    return tokens.length;
  }

  /**
   * Get all active tokens for a user
   * @param userId - User ID
   * @returns Array of tokens
   */
  async getUserTokens(userId: string): Promise<string[]> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    return this.redis.smembers(userTokensKey);
  }

  /**
   * Get count of active tokens for a user
   * @param userId - User ID
   * @returns Number of active tokens
   */
  async getUserTokenCount(userId: string): Promise<number> {
    const userTokensKey = `${this.USER_TOKENS_PREFIX}${userId}`;
    return this.redis.scard(userTokensKey);
  }

  /**
   * Extend token TTL (e.g., on refresh)
   * @param token - JWT token
   * @param ttl - New TTL in seconds
   */
  async extendTokenTTL(token: string, ttl: number): Promise<void> {
    const tokenKey = `${this.TOKEN_PREFIX}${token}`;
    await this.redis.expire(tokenKey, ttl);
  }

  /**
   * Clean up expired tokens (optional, Redis does this automatically)
   * But useful for getting stats
   */
  async cleanupExpiredTokens(): Promise<number> {
    // This is mostly handled by Redis TTL, but we can scan for orphaned entries
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.TOKEN_PREFIX}*`,
        'COUNT',
        100
      );
      cursor = newCursor;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // No TTL set, clean it up
          await this.redis.del(key);
          deletedCount++;
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  }
}

// Export singleton instance
export const authTokenCache = new AuthTokenCacheService();
