import Trip from '../features/trip/trip.model';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import { cacheService } from './redis-cache.service';
import { SubscriptionService } from './subscription.service';
import { ErrorResponse } from '../utils/responses';
import { IncomingTripData } from '../types/trip';

export class BackgroundRunnersService {
  private static isRunning = false;
  private static runner1Interval: NodeJS.Timeout | null = null;
  private static runner2Interval: NodeJS.Timeout | null = null;

  /**
   * Start both background runners
   */
  static start() {
    if (this.isRunning) {
      console.log('⚠️ Background runners already running');
      return;
    }

    this.isRunning = true;

    // Runner 1: Process searching trips every 10 seconds
    this.runner1Interval = setInterval(() => {
      this.runDriverSearchRunner().catch((error) =>
        console.error('❌ Driver Search Runner error:', error)
      );
    }, 10000);

    // Runner 2: Cleanup expired incoming trips every 10 seconds
    this.runner2Interval = setInterval(() => {
      this.runCleanupRunner().catch((error) =>
        console.error('❌ Cleanup Runner error:', error)
      );
    }, 10000);

    console.log('✅ Background runners started (10-second intervals)');
  }

  /**
   * Stop both background runners
   */
  static stop() {
    if (!this.isRunning) return;

    if (this.runner1Interval) {
      clearInterval(this.runner1Interval);
      this.runner1Interval = null;
    }

    if (this.runner2Interval) {
      clearInterval(this.runner2Interval);
      this.runner2Interval = null;
    }

    this.isRunning = false;
    console.log('🛑 Background runners stopped');
  }

  /**
   * BACKGROUND RUNNER 1: Find drivers for searching trips
   */
  private static async runDriverSearchRunner() {
    try {
      // Get all trips with status "searching"
      const searchingTrips = await Trip.find({
        status: 'searching',
      }).limit(50); // Process max 50 at a time

      if (searchingTrips.length === 0) {
        return; // No trips to process
      }

      console.log(`🔍 Processing ${searchingTrips.length} searching trips`);

      for (const trip of searchingTrips) {
        await this.processSearchingTrip(trip);
      }
    } catch (error: any) {
      console.error('❌ Driver Search Runner failed:', error.message);
    }
  }

  /**
   * Process individual searching trip
   */
  private static async processSearchingTrip(trip: any) {
    try {
      // Find nearby drivers
      const nearbyDrivers = await cacheService.findNearbyDrivers(
        trip.pickup.location.coordinates,
        5, // 5km radius
        20 // max 20 drivers
      );

      if (nearbyDrivers.length === 0) {
        console.log(`📍 No drivers found for trip ${trip.tripNumber}`);
        return;
      }

      // Get customer info
      const customer = await Customer.findById(trip.customerId);
      if (!customer) {
        console.error(`❌ Customer not found for trip ${trip._id}`);
        return;
      }

      // Create incoming trip data
      const incomingTripData: IncomingTripData = {
        tripId: trip._id.toString(),
        customerId: trip.customerId,
        customerInfo: {
          name: `${customer.firstname} ${customer.lastname}`,
          phone: customer.phone.fullPhone,
          photo: customer.profilePhoto,
        },
        pickup: {
          address: trip.pickup.address,
          coordinates: trip.pickup.location.coordinates,
        },
        destination: {
          address: trip.destination.address,
          coordinates: trip.destination.location.coordinates,
        },
        pricing: trip.pricing,
        paymentMethod: trip.paymentMethod,
        requestedAt: trip.createdAt,
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
      };

      // Store incoming trip in Redis for each driver
      for (const driverId of nearbyDrivers) {
        await cacheService.createIncomingTripInRedis(
          driverId,
          incomingTripData
        );
      }

      // Update trip status to "drivers_found"
      await Trip.findByIdAndUpdate(trip._id, {
        status: 'drivers_found',
        driversNotified: nearbyDrivers.length,
        driversFoundAt: new Date(),
      });

      // Publish trip lifecycle update
      await SubscriptionService.publishTripLifecycleUpdate({
        tripId: trip._id.toString(),
        status: 'drivers_found',
        message: `Found ${nearbyDrivers.length} nearby drivers`,
        driversNotified: nearbyDrivers.length,
        timestamp: new Date(),
      });

      // Notify drivers via subscription
      await SubscriptionService.publishNewTripRequest(
        nearbyDrivers,
        incomingTripData
      );

      console.log(
        `✅ Trip ${trip.tripNumber} sent to ${nearbyDrivers.length} drivers`
      );
    } catch (error: any) {
      console.error(`❌ Failed to process trip ${trip._id}:`, error.message);
    }
  }

  /**
   * BACKGROUND RUNNER 2: Cleanup expired incoming trips
   */
  private static async runCleanupRunner() {
    try {
      // Get all driver IDs from location cache
      const driverIds = await cacheService.getAllCachedDriverIds();

      let totalExpiredCount = 0;
      let totalResetTripsCount = 0;

      for (const driverId of driverIds) {
        const result = await this.cleanupExpiredTripsForDriver(driverId);
        totalExpiredCount += result.expiredCount;
        totalResetTripsCount += result.resetTripsCount;
      }

      if (totalExpiredCount > 0) {
        console.log(
          `🧹 Cleaned up ${totalExpiredCount} expired incoming trips, reset ${totalResetTripsCount} trips to searching`
        );
      }
    } catch (error: any) {
      console.error('❌ Cleanup Runner failed:', error.message);
    }
  }

  /**
   * Cleanup expired trips for specific driver (separated into Redis + Business Logic)
   */
  private static async cleanupExpiredTripsForDriver(driverId: string): Promise<{
    expiredCount: number;
    resetTripsCount: number;
  }> {
    try {
      // Part 1: Redis cleanup (pure Redis operations)
      const redisResult =
        await cacheService.cleanupExpiredIncomingTripsForDriver(driverId);

      // Part 2: Business logic for expired trips
      const resetTripsCount = await this.handleExpiredTrips(
        redisResult.expiredTripIds
      );

      return {
        expiredCount: redisResult.expiredCount,
        resetTripsCount,
      };
    } catch (error: any) {
      console.error(
        `❌ Failed to cleanup trips for driver ${driverId}:`,
        error.message
      );
      return { expiredCount: 0, resetTripsCount: 0 };
    }
  }

  /**
   * Handle expired trips business logic (reset to searching, publish updates)
   */
  private static async handleExpiredTrips(
    expiredTripIds: string[]
  ): Promise<number> {
    let resetTripsCount = 0;

    // Reset trips back to "searching" status and update lifecycle
    for (const tripId of expiredTripIds) {
      try {
        // Check if no driver has accepted this trip
        const trip = await Trip.findById(tripId);

        if (trip && trip.status === 'drivers_found') {
          // Reset to searching
          await Trip.findByIdAndUpdate(tripId, {
            status: 'searching',
            driversNotified: 0,
            driversFoundAt: null,
          });

          // Update Trip Lifecycle Subscription
          await SubscriptionService.publishTripLifecycleUpdate({
            tripId: tripId,
            status: 'searching',
            message: 'No driver accepted, searching again...',
            timestamp: new Date(),
          });

          resetTripsCount++;
        }
      } catch (error: any) {
        console.error(`❌ Failed to reset trip ${tripId}:`, error.message);
      }
    }

    return resetTripsCount;
  }

  /**
   * Get incoming trips for driver (from Redis)
   */
  static async getIncomingTripsForDriver(
    driverId: string
  ): Promise<IncomingTripData[]> {
    return await cacheService.getIncomingTripsForDriver(driverId);
  }

  /**
   * Remove specific incoming trip for driver
   */
  static async removeIncomingTripForDriver(
    driverId: string,
    tripId: string
  ): Promise<void> {
    return await cacheService.removeIncomingTripForDriver(driverId, tripId);
  }

  /**
   * Clear incoming trip from all drivers' Redis queues
   */
  static async clearIncomingTripForAllDrivers(tripId: string): Promise<void> {
    return await cacheService.clearIncomingTripForAllDrivers(tripId);
  }

  /**
   * Get background runners status and statistics
   */
  static async getStatus() {
    const searchingTripsCount = await Trip.countDocuments({
      status: 'searching',
    });
    const driversFoundTripsCount = await Trip.countDocuments({
      status: 'drivers_found',
    });

    // Get incoming trips count across all drivers
    const incomingTripsStats = await cacheService.getIncomingTripsStats();

    const stats = {
      isRunning: this.isRunning,
      searchingTrips: searchingTripsCount,
      driversFoundTrips: driversFoundTripsCount,
      totalIncomingTripsInRedis: incomingTripsStats.totalCount,
      lastRunTime: new Date(),
      uptimeSeconds: this.isRunning ? Math.floor(process.uptime()) : 0,
    };

    return stats;
  }

  /**
   * Get detailed Redis inspection for debugging
   */
  static async getRedisInspection() {
    try {
      return await cacheService.getIncomingTripsInspection();
    } catch (error: any) {
      return {
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Manually trigger driver search runner (for testing/admin)
   */
  static async manuallyRunDriverSearch(): Promise<void> {
    await this.runDriverSearchRunner();
  }

  /**
   * Manually trigger cleanup runner (for testing/admin)
   */
  static async manuallyRunCleanup(): Promise<void> {
    await this.runCleanupRunner();
  }
}
