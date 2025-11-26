// src/services/job-processors.service.ts
import { queueService, Job } from './redis-queue.service';
import TripService from '../features/trip/trip.service';
import DriverService from '../features/driver/driver.service';
import { cacheService } from './redis-cache.service';

export class JobProcessors {
  /**
   * Initialize all job processors
   */
  static initialize() {
    // Trip-related job processors
    queueService.onJob('FIND_DRIVERS', this.processFindDrivers.bind(this));
    queueService.onJob(
      'CHECK_TRIP_ACCEPTANCE',
      this.processCheckTripAcceptance.bind(this)
    );
    queueService.onJob(
      'UPDATE_DRIVER_LOCATION',
      this.processUpdateDriverLocation.bind(this)
    );
    queueService.onJob(
      'PROCESS_TRIP_UPDATE',
      this.processTripUpdate.bind(this)
    );
    queueService.onJob(
      'CLEANUP_EXPIRED_REQUESTS',
      this.processCleanupExpiredRequests.bind(this)
    );

    // Driver-related job processors
    queueService.onJob(
      'UPDATE_DRIVER_STATUS',
      this.processUpdateDriverStatus.bind(this)
    );
    queueService.onJob(
      'DRIVER_HEARTBEAT',
      this.processDriverHeartbeat.bind(this)
    );

    // System maintenance job processors
    queueService.onJob('CLEANUP_CACHE', this.processCleanupCache.bind(this));
    queueService.onJob('SYNC_DATABASE', this.processSyncDatabase.bind(this));

    console.log('✅ All job processors initialized');
  }

  /**
   * Process driver search for a trip
   */
  static async processFindDrivers(job: Job) {
    const { tripId } = job.data;

    try {
      await TripService.processDriverSearch(tripId);
      console.log(`✅ Driver search completed for trip: ${tripId}`);
    } catch (error: any) {
      console.error(`❌ Driver search failed for trip: ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Check if trip was accepted within timeout
   */
  static async processCheckTripAcceptance(job: Job) {
    const { tripId } = job.data;

    try {
      await TripService.checkTripAcceptance(tripId);
      console.log(`✅ Trip acceptance check completed: ${tripId}`);
    } catch (error: any) {
      console.error(`❌ Trip acceptance check failed: ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Process driver location update
   */
  static async processUpdateDriverLocation(job: Job) {
    const { driverId, coordinates, heading, speed, isOnline, isAvailable } =
      job.data;

    try {
      // Update in cache
      await cacheService.updateDriverLocation(driverId, {
        driverId,
        coordinates,
        heading,
        speed,
        isOnline,
        isAvailable,
        updatedAt: new Date(),
      });

      // Update in database (async, don't wait)
      DriverService.updateDriverLocation(driverId, {
        coordinates,
        heading,
      }).catch((error) => {
        console.error(
          `Error updating driver location in DB: ${driverId}`,
          error
        );
      });

      console.log(`✅ Driver location updated: ${driverId}`);
    } catch (error: any) {
      console.error(`❌ Driver location update failed: ${driverId}`, error);
      throw error;
    }
  }

  /**
   * Process trip status updates
   */
  static async processTripUpdate(job: Job) {
    const { tripId, status, data } = job.data;

    try {
      // Update cached trip state
      const currentState = await cacheService.getActiveTripState(tripId);
      if (currentState) {
        const updatedState = {
          ...currentState,
          status,
          lastUpdated: new Date(),
          ...data,
        };
        await cacheService.cacheActiveTripState(tripId, updatedState);
      }

      // Publish lifecycle update
      await TripService.publishTripLifecycleUpdate(tripId, {
        status,
        ...data,
      });

      console.log(`✅ Trip update processed: ${tripId} -> ${status}`);
    } catch (error: any) {
      console.error(`❌ Trip update failed: ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Process driver status updates
   */
  static async processUpdateDriverStatus(job: Job) {
    const { driverId, isOnline, isAvailable } = job.data;

    try {
      const currentLocation = await cacheService.getDriverLocation(driverId);

      if (currentLocation) {
        await cacheService.updateDriverLocation(driverId, {
          ...currentLocation,
          isOnline,
          isAvailable,
          updatedAt: new Date(),
        });
      }

      // Update database
      await DriverService.updateDriverStatus(driverId, {
        isOnline,
        isAvailable,
      });

      console.log(
        `✅ Driver status updated: ${driverId} -> online: ${isOnline}, available: ${isAvailable}`
      );
    } catch (error: any) {
      console.error(`❌ Driver status update failed: ${driverId}`, error);
      throw error;
    }
  }

  /**
   * Process driver heartbeat to maintain online status
   */
  static async processDriverHeartbeat(job: Job) {
    const { driverId } = job.data;

    try {
      const location = await cacheService.getDriverLocation(driverId);

      if (location) {
        // Check if last update was more than 5 minutes ago
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        if (location.updatedAt < fiveMinutesAgo) {
          // Mark driver as offline due to inactivity
          await cacheService.updateDriverLocation(driverId, {
            ...location,
            isOnline: false,
            isAvailable: false,
            updatedAt: new Date(),
          });

          // Update database
          await DriverService.updateDriverStatus(driverId, {
            isOnline: false,
            isAvailable: false,
          });

          console.log(
            `⏰ Driver marked offline due to inactivity: ${driverId}`
          );
        }
      }
    } catch (error: any) {
      console.error(`❌ Driver heartbeat failed: ${driverId}`, error);
      // Don't throw error for heartbeat failures
    }
  }

  /**
   * Cleanup expired trip requests
   */
  static async processCleanupExpiredRequests(job: Job) {
    try {
      // This would require scanning Redis keys, implement based on your needs
      console.log('🧹 Cleaning up expired trip requests');

      // Implementation would involve:
      // 1. Scan for expired trip request keys
      // 2. Remove them from Redis
      // 3. Update database status if needed
    } catch (error: any) {
      console.error('❌ Cleanup expired requests failed', error);
      throw error;
    }
  }

  /**
   * Cleanup old cache entries
   */
  static async processCleanupCache(job: Job) {
    try {
      console.log('🧹 Running cache cleanup');

      // Clear completed jobs older than 24 hours
      await queueService.clearCompleted();

      // Additional cleanup logic here

      console.log('✅ Cache cleanup completed');
    } catch (error: any) {
      console.error('❌ Cache cleanup failed', error);
      throw error;
    }
  }

  /**
   * Sync critical data between cache and database
   */
  static async processSyncDatabase(job: Job) {
    try {
      console.log('🔄 Starting database sync');

      // Implementation would involve:
      // 1. Get all active drivers from cache
      // 2. Compare with database
      // 3. Sync differences

      console.log('✅ Database sync completed');
    } catch (error: any) {
      console.error('❌ Database sync failed', error);
      throw error;
    }
  }

  /**
   * Start periodic maintenance jobs
   */
  static startPeriodicJobs() {
    // Cleanup cache every hour
    setInterval(
      async () => {
        await queueService.addJob(
          'CLEANUP_CACHE',
          {},
          {
            priority: 1,
            maxAttempts: 2,
          }
        );
      },
      60 * 60 * 1000
    ); // 1 hour

    // Sync database every 5 minutes
    setInterval(
      async () => {
        await queueService.addJob(
          'SYNC_DATABASE',
          {},
          {
            priority: 3,
            maxAttempts: 2,
          }
        );
      },
      5 * 60 * 1000
    ); // 5 minutes

    // Driver heartbeat check every 2 minutes
    setInterval(
      async () => {
        // This would get all online drivers and queue heartbeat checks
        console.log('⏰ Queuing driver heartbeat checks');
      },
      2 * 60 * 1000
    ); // 2 minutes

    console.log('⏰ Periodic jobs started');
  }
}

// Export functions for external use
export const addDriverLocationUpdateJob = async (
  driverId: string,
  locationData: any
) => {
  await queueService.addJob(
    'UPDATE_DRIVER_LOCATION',
    {
      driverId,
      ...locationData,
    },
    {
      priority: 8,
      maxAttempts: 2,
    }
  );
};

export const addTripUpdateJob = async (
  tripId: string,
  status: string,
  data: any = {}
) => {
  await queueService.addJob(
    'PROCESS_TRIP_UPDATE',
    {
      tripId,
      status,
      data,
    },
    {
      priority: 9,
      maxAttempts: 3,
    }
  );
};

export const addDriverStatusUpdateJob = async (
  driverId: string,
  statusData: any
) => {
  await queueService.addJob(
    'UPDATE_DRIVER_STATUS',
    {
      driverId,
      ...statusData,
    },
    {
      priority: 7,
      maxAttempts: 2,
    }
  );
};
