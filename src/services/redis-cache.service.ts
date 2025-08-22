import Redis from 'ioredis';
import { ENV } from '../config/env';

export interface DriverLocation {
  driverId: string;
  coordinates: [number, number];
  heading?: number;
  speed?: number;
  isOnline: boolean;
  isAvailable: boolean;
  updatedAt: Date;
}

export interface TripRequest {
  tripId: string;
  customerId: string;
  pickup: {
    address: string;
    coordinates: [number, number];
  };
  destination: {
    address: string;
    coordinates: [number, number];
  };
  pricing: any;
  paymentMethod: string;
  requestedAt: Date;
  searchRadius: number;
  attempts: number;
}

export class RedisCacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: ENV.REDIS_HOST,
      port: parseInt(ENV.REDIS_PORT),
      password: ENV.REDIS_PASSWORD,
      db: 2, // Use different DB for cache
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis Cache connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis Cache error:', error);
    });
  }

  // =================
  // DRIVER LOCATIONS
  // =================

  /**
   * Update driver location and status
   */
  async updateDriverLocation(
    driverId: string,
    location: DriverLocation
  ): Promise<void> {
    const key = `driver:location:${driverId}`;
    const geoKey = 'drivers:geo';

    // Store driver location data
    await this.redis.hset(key, {
      coordinates: JSON.stringify(location.coordinates),
      heading: location.heading || 0,
      speed: location.speed || 0,
      isOnline: location.isOnline,
      isAvailable: location.isAvailable,
      updatedAt: location.updatedAt.toISOString(),
    });

    // Set TTL for location data
    await this.redis.expire(key, 300); // 5 minutes

    // Update geospatial index for nearby searches
    if (location.isOnline) {
      await this.redis.geoadd(
        geoKey,
        location.coordinates[0], // longitude
        location.coordinates[1], // latitude
        driverId
      );
      await this.redis.expire(geoKey, 300);
    } else {
      // Remove from geo index if offline
      await this.redis.zrem(geoKey, driverId);
    }
  }

  // Add to RedisCacheService
  async getMultipleDriverLocations(
    driverIds: string[]
  ): Promise<Record<string, DriverLocation | null>> {
    const pipeline = this.redis.pipeline();

    // Batch all the hgetall commands
    driverIds.forEach((driverId) => {
      const key = `driver:location:${driverId}`;
      pipeline.hgetall(key);
    });

    const results = await pipeline.exec();
    const locations: Record<string, DriverLocation | null> = {};

    driverIds.forEach((driverId, index) => {
      const [err, data] = results![index];
      if (!err && data && (data as any).coordinates) {
        locations[driverId] = {
          driverId,
          coordinates: JSON.parse((data as any).coordinates),
          heading: parseFloat((data as any).heading),
          speed: parseFloat((data as any).speed),
          isOnline: (data as any).isOnline === 'true',
          isAvailable: (data as any).isAvailable === 'true',
          updatedAt: new Date((data as any).updatedAt),
        };
      } else {
        locations[driverId] = null;
      }
    });

    return locations;
  }

  /**
   * Get driver location
   */
  async getDriverLocation(driverId: string): Promise<DriverLocation | null> {
    const key = `driver:location:${driverId}`;
    const data = await this.redis.hgetall(key);
    console.log(key, 'key');
    console.log('data from get driver location: ', data);
    console.log(
      'coordinates from get driver location: ',
      JSON.parse(data.coordinates)
    );
    console.log('data from get driver location: ', data.coordinates);
    if (!data || !data.coordinates) return null;

    return {
      driverId,
      coordinates: JSON.parse(data.coordinates),
      heading: parseFloat(data.heading),
      speed: parseFloat(data.speed),
      isOnline: data.isOnline === 'true',
      isAvailable: data.isAvailable === 'true',
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Find nearby available drivers
   */
  async findNearbyDrivers(
    coordinates: [number, number],
    radiusKm: number = 5,
    limit: number = 20
  ): Promise<string[]> {
    const geoKey = 'drivers:geo';

    // Use GEORADIUS to find drivers within radius
    const nearbyDrivers = (await this.redis.georadius(
      geoKey,
      coordinates[0],
      coordinates[1],
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      limit
    )) as [string, number][];

    const availableDrivers: string[] = [];

    for (const [driverId] of nearbyDrivers) {
      const location = await this.getDriverLocation(driverId);
      if (location && location.isOnline && location.isAvailable) {
        availableDrivers.push(driverId);
      }
    }

    return availableDrivers;
  }

  /**
   * Remove driver from location tracking
   */
  async removeDriverLocation(driverId: string): Promise<void> {
    const key = `driver:location:${driverId}`;
    const geoKey = 'drivers:geo';

    await Promise.all([this.redis.del(key), this.redis.zrem(geoKey, driverId)]);
  }

  // =================
  // TRIP MANAGEMENT
  // =================

  /**
   * Cache trip request for driver matching
   */
  async cacheTripRequest(tripId: string, request: TripRequest): Promise<void> {
    const key = `trip:request:${tripId}`;

    await this.redis.hset(key, {
      tripId: request.tripId,
      customerId: request.customerId,
      pickup: JSON.stringify(request.pickup),
      destination: JSON.stringify(request.destination),
      pricing: JSON.stringify(request.pricing),
      paymentMethod: request.paymentMethod,
      requestedAt: request.requestedAt.toISOString(),
      searchRadius: request.searchRadius,
      attempts: request.attempts,
    });

    // Set TTL for trip request (15 minutes)
    await this.redis.expire(key, 900);
  }

  /**
   * Get cached trip request
   */
  async getTripRequest(tripId: string): Promise<TripRequest | null> {
    const key = `trip:request:${tripId}`;
    const data = await this.redis.hgetall(key);

    if (!data || !data.tripId) return null;

    return {
      tripId: data.tripId,
      customerId: data.customerId,
      pickup: JSON.parse(data.pickup),
      destination: JSON.parse(data.destination),
      pricing: JSON.parse(data.pricing),
      paymentMethod: data.paymentMethod,
      requestedAt: new Date(data.requestedAt),
      searchRadius: parseFloat(data.searchRadius),
      attempts: parseInt(data.attempts),
    };
  }

  /**
   * Remove trip request from cache
   */
  async removeTripRequest(tripId: string): Promise<void> {
    const key = `trip:request:${tripId}`;
    await this.redis.del(key);
  }

  /**
   * Cache active trip state
   */
  async cacheActiveTripState(
    tripId: string,
    state: any,
    ttl: number = 3600
  ): Promise<void> {
    const key = `trip:active:${tripId}`;
    await this.redis.setex(key, ttl, JSON.stringify(state));
  }

  /**
   * Get active trip state
   */
  async getActiveTripState(tripId: string): Promise<any | null> {
    const key = `trip:active:${tripId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Remove active trip state
   */
  async removeActiveTripState(tripId: string): Promise<void> {
    const key = `trip:active:${tripId}`;
    await this.redis.del(key);
  }

  // =================
  // SESSION MANAGEMENT
  // =================

  /**
   * Cache user session
   */
  async cacheUserSession(
    userId: string,
    sessionData: any,
    ttl: number = 86400
  ): Promise<void> {
    const key = `session:${userId}`;
    await this.redis.setex(key, ttl, JSON.stringify(sessionData));
  }

  /**
   * Get user session
   */
  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Remove user session
   */
  async removeUserSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.redis.del(key);
  }

  // =================
  // RATE LIMITING
  // =================

  /**
   * Check and increment rate limit
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const redisKey = `rate:${key}`;
    const current = await this.redis.incr(redisKey);

    if (current === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }

    const ttl = await this.redis.ttl(redisKey);
    const resetTime = Date.now() + ttl * 1000;

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime,
    };
  }

  // =================
  // CONFIGURATION
  // =================

  /**
   * Cache configuration
   */
  async cacheConfig(
    key: string,
    config: any,
    ttl: number = 3600
  ): Promise<void> {
    const redisKey = `config:${key}`;
    await this.redis.setex(redisKey, ttl, JSON.stringify(config));
  }

  /**
   * Get cached configuration
   */
  async getConfig(key: string): Promise<any | null> {
    const redisKey = `config:${key}`;
    const data = await this.redis.get(redisKey);
    return data ? JSON.parse(data) : null;
  }

  // =================
  // ANALYTICS COUNTERS
  // =================

  /**
   * Increment counter
   */
  async incrementCounter(key: string, increment: number = 1): Promise<number> {
    return await this.redis.incrby(`counter:${key}`, increment);
  }

  /**
   * Get counter value
   */
  async getCounter(key: string): Promise<number> {
    const value = await this.redis.get(`counter:${key}`);
    return value ? parseInt(value) : 0;
  }

  /**
   * Reset counter
   */
  async resetCounter(key: string): Promise<void> {
    await this.redis.del(`counter:${key}`);
  }

  // =================
  // UTILITY METHODS
  // =================

  /**
   * Set with TTL
   */
  async setWithTTL(key: string, value: any, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  /**
   * Get JSON value
   */
  async getJSON(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete key
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
}

// Singleton instance
export const cacheService = new RedisCacheService();
